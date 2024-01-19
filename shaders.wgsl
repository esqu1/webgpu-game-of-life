@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage> cellState: array<u32>;

@vertex
fn vertexMain(@location(0) pos: vec2f, @builtin(instance_index) instance: u32) -> @builtin(position) vec4f {
    let i = f32(instance);
    let state = f32(cellState[instance]);
    let cell = vec2f(i % grid.x, floor(i / grid.x));
    let cellOffset = cell / grid;
    return vec4f((pos * state + 1) / grid - 1 + 2 * cellOffset, 0, 1);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
    return vec4f(1, 0, 0, 1);
}
