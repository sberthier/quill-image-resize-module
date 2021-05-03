import { BaseModule } from './BaseModule';

export class DisplaySize extends BaseModule {
    onCreate = () => {
        // Create the container to hold the size display
        this.display = document.createElement('div');

        // Apply styles
        Object.assign(this.display.style, this.options.displayStyles);

        // Attach it
        this.overlay.appendChild(this.display);
    };

    onDestroy = () => {};

    onUpdate = () => {
        if (!this.display || !this.img) {
            return;
        }

        const size = this.getCurrentSize();
        this.display.innerHTML = size.join(' &times; ');
        if (size[0] > 120 && size[1] > 30) {
            // position on top of image
            Object.assign(this.display.style, {
                right: '4px',
                bottom: '4px',
                left: 'auto',
            });
        }
        else if (this.img.style.float == 'right') {
			// position off bottom left
            Object.assign(this.display.style, {
                right: 'auto',
                bottom: `-${this.display.offsetHeight + 4}px`,
                left: `-${this.display.offsetWidth + 4}px`,
            });
        }
        else {
            // position off bottom right
            Object.assign(this.display.style, {
                right: `-${this.display.offsetWidth + 4}px`,
                bottom: `-${this.display.offsetHeight + 4}px`,
                left: 'auto',
            });
        }
    };

    getCurrentSize = () => [
        this.img.width,
        Math.round((this.img.width / this.img.naturalWidth) * this.img.naturalHeight),
    ];
}
