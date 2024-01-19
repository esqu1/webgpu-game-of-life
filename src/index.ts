import shaderCode from '../shaders/shaders.wgsl'
import computeCode from '../shaders/gameoflife.compute.wgsl'

const vertices = new Float32Array([
    //   X,    Y,
    -0.8, -0.8, // Triangle 1 (Blue)
    0.8, -0.8,
    0.8, 0.8,

    -0.8, -0.8, // Triangle 2 (Red)
    0.8, 0.8,
    -0.8, 0.8,
])

window.addEventListener('keydown', (e) => { if (e.key == 'o') { alert("hi!") } })

const GRID_SIZE = 32
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE])


const WORKGROUP_SIZE = 8

export async function main() {
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.")
    }

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.")
    }

    const device = await adapter.requestDevice()

    // Set up the canvas
    const canvas = document.querySelector("canvas")
    const context = canvas.getContext("webgpu")
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat()
    context.configure({
        device: device,
        format: canvasFormat
    })

    const vertexBuffer = device.createBuffer({
        label: "Cell vertices",
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(vertexBuffer, 0, vertices)

    const uniformBuffer = device.createBuffer({
        label: "Grid Uniforms",
        size: uniformArray.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(uniformBuffer, 0, uniformArray)


    const vertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 8, // 4 bytes per float32, and 2 each
        attributes: [{
            format: "float32x2",
            offset: 0,
            shaderLocation: 0,
        }]
    }

    const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE)
    for (let i = 0; i < cellStateArray.length; i += 3) {
        cellStateArray[i] = Math.random() > 0.6 ? 1 : 0
    }

    const cellShaderModule = device.createShaderModule({
        label: "Cell shader",
        code: shaderCode
    })

    const simulationShaderModule = device.createShaderModule({
        label: "Game of Life simulation shader",
        code: computeCode
    })

    // uniform buffers have limited size, cannot dynamically size, and can't be written to by compute shaders
    const cellStateStorage = [
        device.createBuffer({
            label: "Cell State A",
            size: cellStateArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }),
        device.createBuffer({
            label: "Cell State B",
            size: cellStateArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        })
    ]
    device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray)
    device.queue.writeBuffer(cellStateStorage[1], 0, cellStateArray)

    const bindGroupLayout = device.createBindGroupLayout({
        label: "Cell Bind Group Layout",
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: {}
        }, {
            binding: 1,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" }
        }, {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage" }
        }]
    })

    const bindGroups = [device.createBindGroup({
        label: "Cell renderer bind group A",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }, {
            binding: 1,
            resource: { buffer: cellStateStorage[0] }
        }, {
            binding: 2,
            resource: { buffer: cellStateStorage[1] }
        }]
    }), device.createBindGroup({
        label: "Cell renderer bind group B",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }, {
            binding: 1,
            resource: { buffer: cellStateStorage[1] }
        }, {
            binding: 2,
            resource: { buffer: cellStateStorage[0] }
        }]
    })]

    const pipelineLayout = device.createPipelineLayout({
        label: "Cell Pipeline Layout",
        bindGroupLayouts: [bindGroupLayout]
    })
    const cellPipeline = device.createRenderPipeline({
        label: "Cell pipeline",
        layout: pipelineLayout,
        vertex: {
            module: cellShaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout]
        },
        fragment: {
            module: cellShaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: canvasFormat
            }]
        }
    })

    const simulationPipeline = device.createComputePipeline({
        label: "Simulation pipeline",
        layout: pipelineLayout,
        compute: {
            module: simulationShaderModule,
            entryPoint: "computeMain"
        }
    })

    let step = 0

    function onFrame() {
        const encoder = device.createCommandEncoder()
        const computePass = encoder.beginComputePass()
        computePass.setPipeline(simulationPipeline)
        computePass.setBindGroup(0, bindGroups[step % 2])
        computePass.dispatchWorkgroups(8, 8)
        computePass.end()
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: { r: 0, g: 0, b: 0.4, a: 1 },
                storeOp: "store"
            }]
        })
        pass.setPipeline(cellPipeline)
        pass.setBindGroup(0, bindGroups[step % 2])
        pass.setVertexBuffer(0, vertexBuffer)
        pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE)
        pass.end()

        const commandBuffer = encoder.finish()
        device.queue.submit([commandBuffer])
        step++
    }

    setInterval(onFrame, 200)
}


(async () => {
    await main()
})()