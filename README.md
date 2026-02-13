# Black Hole Galaxy Simulator

An interactive N-body physics simulation featuring black holes, gravitational dynamics, and galaxy collisions. Built with vanilla JavaScript and HTML5 Canvas, this simulator demonstrates advanced numerical integration techniques and astrophysical phenomena.

![Black Hole Galaxy Simulator](https://img.shields.io/badge/physics-n--body-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Physics Simulation
- **Advanced Numerical Integration**: Toggle between RK4 (Runge-Kutta 4th order) and Euler methods
- **Barnes-Hut Algorithm**: Efficient O(n log n) gravitational calculations using quad-tree optimization
- **Dark Matter Halo**: NFW-like density profile modeling
- **Relativistic Effects**: Schwarzschild radius and time dilation calculations
- **Softening Parameter**: Prevents numerical singularities in close encounters

### Interactive Elements
- **Binary Black Hole System**: Simulate orbital mechanics of two supermassive black holes
- **Galaxy Collisions**: Watch two galaxies merge in real-time
- **Comet Injection**: Add highly eccentric orbits to the simulation
- **Dynamic Spawning**: Click to add new bodies, right-click to create repulsive forces
- **Save/Load System**: Preserve and restore simulation states

### Visualization
- **Particle Trails**: Motion paths with configurable fade
- **Real-time Telemetry**: Live graphs tracking black hole mass and body count
- **Physics Overlay**: Display Schwarzschild radius, time dilation, and Kepler orbital periods
- **Accretion Effects**: Visual feedback when bodies are consumed by black holes
- **Explosion Animations**: Dynamic visual effects for collisions

## Demo

[Live Demo](#) <!-- Add your GitHub Pages link here -->

## Installation

Clone the repository and open `index.html` in a modern web browser:

```bash
git clone https://github.com/Aad1tyaDev/black-hole-galaxy-simulator.git
cd black-hole-galaxy-simulator
# Open index.html in your browser
```

No build process or dependencies required!

## Controls

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Space` | Pause/Resume simulation |
| `R` | Reset to default galaxy |
| `T` | Toggle particle trails |
| `+` / `-` | Increase/Decrease gravity constant |
| `Z` / `X` | Decrease/Increase softening parameter |
| `B` | Initialize binary black hole system |
| `C` | Add comet with eccentric orbit |
| `G` | Start galaxy collision scenario |
| `K` | Save current simulation state |
| `L` | Load saved simulation state |

### Mouse Controls
- **Left Click**: Spawn new body at cursor position
- **Right Click**: Create temporary repulsive force
- **Mouse Wheel**: Zoom in/out

### UI Sliders
- **Speed**: Adjust simulation time step (0.02x - 4.00x)
- **Gravity G**: Modify gravitational constant (0.05 - 2.00)
- **Softening ε**: Adjust collision softening (1.0 - 50.0 units)
- **Zoom**: Camera zoom level (0.2x - 2.0x)

### Checkboxes
- **RK4 Integrator**: Use 4th-order Runge-Kutta integration (more accurate but slower)
- **Quad-Tree Gravity**: Enable Barnes-Hut algorithm for O(n log n) performance
- **Show Debug**: Display metrics, telemetry graphs, and physics calculations

## Physics Details

### Gravitational Force
The simulation uses Newton's law of universal gravitation with softening:

```
F = G * m1 * m2 / (r² + ε²)
```

Where:
- `G` is the gravitational constant (adjustable)
- `ε` (epsilon) is the softening parameter to prevent singularities
- `r` is the distance between bodies

### Barnes-Hut Algorithm
For simulations with many bodies (>100), the Barnes-Hut quad-tree algorithm approximates distant gravitational forces, reducing computational complexity from O(n²) to O(n log n).

### Relativistic Overlay
The simulation displays real-world physics calculations:
- **Schwarzschild Radius** (rₛ): The event horizon radius for a black hole
  - `rₛ = 2GM/c²`
- **Time Dilation**: Gravitational time dilation factor near the black hole
  - `√(1 - rₛ/r)`
- **Kepler Period**: Classical orbital period for sample bodies
  - `T = 2π√(r³/GM)`

### Dark Matter Halo
An NFW-like density profile models invisible dark matter:
```
ρ(r) = ρ₀ / (r/rₛ * (1 + r/rₛ)²)
```

## Technical Implementation

### Architecture
- **Pure Vanilla JavaScript**: No frameworks or external dependencies
- **Canvas 2D Rendering**: Hardware-accelerated graphics
- **RequestAnimationFrame**: Smooth 60 FPS animation loop
- **LocalStorage Integration**: Persistent state saving

### Performance Optimizations
- Spatial indexing via quad-tree for efficient gravity calculations
- Trail point limiting to prevent memory bloat
- Adaptive rendering with zoom-based culling
- Double-buffered rendering for smooth visuals

### Code Structure
```
├── index.html          # Main HTML structure
├── style.css          # UI styling and layout
└── script.js          # Core simulation engine
    ├── Physics Engine
    │   ├── RK4 Integration
    │   ├── Barnes-Hut Tree
    │   └── Collision Detection
    ├── Rendering System
    │   ├── Camera Transform
    │   ├── Trail Rendering
    │   └── Visual Effects
    └── Event Handling
        ├── Keyboard Input
        ├── Mouse Interaction
        └── UI Controls
```

## Scenarios

### Default Galaxy
220 bodies orbiting a single supermassive black hole, demonstrating stable Keplerian orbits and gravitational dynamics.

### Binary Black Hole System (`B` key)
Two massive black holes orbiting their common barycenter, showcasing complex three-body dynamics and potential gravitational wave emission.

### Galaxy Collision (`G` key)
Two complete galaxies on a collision course, simulating the type of merger seen in real astronomical events like the Antennae Galaxies or Mice Galaxies.

### Comet Mode (`C` key)
Inject bodies with highly eccentric orbits that dive close to the black hole, demonstrating tidal forces and potential capture/ejection scenarios.

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requires support for:
- HTML5 Canvas
- ES6 JavaScript features
- LocalStorage API
- RequestAnimationFrame

## Future Enhancements

Potential additions for future versions:
- [ ] Gravitational wave visualization
- [ ] Jet emission from black holes
- [ ] Stellar evolution and lifecycle
- [ ] Multiple galaxy morphologies (spiral, elliptical)
- [ ] Export simulation data (CSV/JSON)
- [ ] WebGL rendering for larger N
- [ ] Touch controls for mobile devices
- [ ] Preset scenarios gallery

## Physics References

This simulation is inspired by:
- N-body simulation techniques from computational astrophysics
- Barnes-Hut algorithm (1986) for hierarchical force calculation
- Schwarzschild metric from general relativity
- NFW dark matter halo profile (Navarro-Frenk-White, 1996)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by real N-body simulations used in astrophysics research
- Physics calculations based on classical and relativistic mechanics
- Rendering techniques adapted from canvas game development patterns

## Author

Aaditya.D - [GitHub](https://github.com/Aad1tyaDev)

---

**Note**: This is a simplified simulation for educational and visualization purposes. Real astrophysical modeling requires significantly more complex physics including general relativity, stellar dynamics, and electromagnetic forces.
