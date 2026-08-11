# Graphics Remaster

Banker Bros uses an original visual language built around premium 32-bit pixel-art atmosphere, stylized low-poly 3D, Wall Street limestone, banker green, aged brass, navy tailoring, taxi yellow, and restrained market-light accents. It does not reproduce characters, maps, interface assets, music, logos, or proprietary content from another game.

## Upgraded surfaces

- The title screen uses a newly generated, non-destructive `banker-bros-wall-street-key-art-v2.png` remaster with golden opening-bell light, greater architectural detail, clearer characters, and deeper atmosphere.
- The title interface now uses layered glass, vignette, dimensional logo treatment, upgraded buttons, and cinematic framing.
- The 3D renderer uses ACES filmic tone mapping, higher display resolution, improved shadows, session-aware sky colors, distance fog, a visible sun, local workplace lighting, and a subtle game-camera treatment.
- Buildings now have foundations, cornices, floor bands, four-sided emissive windows, entrances, canopies, roof structures, stone trim, and brass accents. The Exchange has a landmark colonnade.
- The district includes a modeled bronze bull, street lamps, trees, benches, crosswalks, curbs, a detailed subway entrance, and animated workplace beacons.
- Cars now have bodies, cabins, wheels, lights, and taxi signage instead of single boxes.
- Banker models now include suits, shirts, ties, arms, shoes, facial pixels, varied skin and accent colors, shadows, and walking limb animation.
- The HUD uses translucent layered panels, improved hierarchy, illuminated energy feedback, richer workplace menus, and responsive interaction animation.
- The top-down district has upgraded pavement, asphalt, grass, carpet, wood, alley, building, window, portrait, sprite, and negotiation-screen materials.

## Performance approach

The city remains dependency-light and procedural. Architecture, vehicles, street props, characters, and atmosphere use Three.js primitives and reusable materials instead of large downloaded model packs. This keeps the project original and makes future districts easy to theme in code.

The renderer caps pixel density, uses bounded fog and lighting, and disposes scene geometry, materials, textures, sprites, and animation frames when the 3D view unmounts. WebGL failure continues to fall back to the existing 2D district.

## Art expansion path

The next asset tier should add authored glTF character animation, modular interior kits, normal/roughness texture atlases, district-specific weather, crowd variety, vehicle variants, storefront props, and cinematic quest cameras. These can build on the current procedural scene without changing the career or onchain systems.
