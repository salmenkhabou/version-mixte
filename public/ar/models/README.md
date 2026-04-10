# Custom AR .glb Models

Use this folder to plug your own product models into the camera AR view.

## Quick steps

1. Export your product model in `.glb` format.
2. Put the file in this folder.
3. Update `public/ar/shared-data.js` in `dishModels`:
   - `model`: your file name
   - `scale`: model scale in AR (example: `0.12 0.12 0.12`)
4. Map a coffee card to that dish id in `coffeeToDishMap`.

## Current custom mapping example

- Coffee card id `1` (Velvet Cappuccino) maps to dish id `velvet_cappuccino`.
- Dish `velvet_cappuccino` uses model file `velvet_cappuccino.glb`.

You can replace `velvet_cappuccino.glb` with your real exported model while keeping the same file name.
