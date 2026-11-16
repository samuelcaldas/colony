# Colony Voxel Jam

Jogo de puzzle 3D (Three.js r128 + React 18 + Tailwind), arquivo único gerado em `dist/index.html`.

## Estrutura
- `src/logic.js` — exposição (flood fill), solver DFS, gerador por descasque, boosters
- `src/bitmaps.js` — converte sprite 32×32 em grade de voxels com limite de cores
- `src/pipeline.js` — pipeline imagem → grade (upload, OpenAI)
- `src/scene.js` — arena 3D, formigas, rotas pelo perímetro
- `src/app.jsx` — UI React, economia, vidas, recompensa diária
- `gen_images.py` — gera as 108 pixel-arts (`images.json`, `images/`)
- `precompute.js` — gera 100 níveis já validados (`levels.json`)

## Build
```
npm install
node precompute.js 100   # opcional: regenera levels.json
node build.js            # gera dist/index.html
```
Requer `@babel/core`, `@babel/preset-react`, `three@0.128.0`, `react@18.2.0`, `react-dom@18.2.0`, `tailwindcss@3` (ver package.json). O `build.js` usa `npx tailwindcss`.

## Economia (resumo)
- Vidas: 5, +1 a cada 4 min. Game Over e reinício consomem 1.
- Moedas: 1ª limpeza do nível (20/35/60 + até 20 extra). Diária 50 × multiplicador (1–5).
- 2x: 3 grátis, depois 🪙30 por nível; liga sozinho ao esvaziar a doca.
- Debug: 7 toques no título do nível.
