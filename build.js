import { context } from "esbuild";
import { glsl } from 'esbuild-plugin-glsl';


const c = await context({
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.js",
    bundle: true,
    plugins: [glsl({
        minify: false
    })]
})

c.watch()