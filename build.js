import { context } from "esbuild";
import { glsl } from 'esbuild-plugin-glsl';


const c = await context({
    entryPoints: ["index.ts"],
    outfile: "index.js",
    bundle: true,
    plugins: [glsl({
        minify: false
    })]
})

c.watch()