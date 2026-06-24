export class ModelRotation {

    constructor() {

        // Liam - Model reference
        this.model = null;

        this.autoRotate = true;

        // rotation speed
        this.rotationSpeed = 0.01;

        // simple boolean to check if mouse is being dragged
        this.dragging = false;

        this.previousMouseX = 0;
    }

    // Storing the laoded up model
    setModel(model) {

        this.model = model;
    }

    // this gets called each frame
    update() {

        if (!this.model) return;

        if (
            this.autoRotate &&
            !this.dragging
        ) {
            this.model.rotation.y +=
                this.rotationSpeed;
        }
    }

    // Mouse pressed
    onMouseDown(event) {

        this.dragging = true;

        this.previousMouseX =
            event.clientX;
    }

    // Mouse moved
    onMouseMove(event) {

        if (
            !this.dragging ||
            !this.model
        ) {
            return;
        }

        const deltaX =
            event.clientX -
            this.previousMouseX;

        this.model.rotation.y +=
            deltaX * 0.01;

        this.previousMouseX =
            event.clientX;
    }

    // Mouse released
    onMouseUp() {

        this.dragging = false;
    }
}