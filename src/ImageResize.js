import Quill from "quill";
import defaultsDeep from 'lodash/defaultsDeep';
import DefaultOptions from './DefaultOptions';
import { DisplaySize } from './modules/DisplaySize';
import { Toolbar } from './modules/Toolbar';
import { Resize } from './modules/Resize';
import { Matrix } from './Matrix'


const knownModules = { DisplaySize, Toolbar, Resize };

/**
 * Custom module for quilljs to allow user to resize <img> elements
 * (Works on Chrome, Edge, Safari and replaces Firefox's native resize behavior)
 * @see https://quilljs.com/blog/building-a-custom-module/
 */
export default class ImageResize {

	constructor(quill, options = {}) {
		// save the quill reference and options
		this.quill = quill;

		// Apply the options to our defaults, and stash them for later
		// defaultsDeep doesn't do arrays as you'd expect, so we'll need to apply the classes array from options separately
		let moduleClasses = false;
		if (options.modules) {
			moduleClasses = options.modules.slice();
		}

		// Apply options to default options
		this.options = defaultsDeep({}, options, DefaultOptions);

		// (see above about moduleClasses)
		if (moduleClasses !== false) {
			this.options.modules = moduleClasses;
		}

		// disable native image resizing on firefox
		document.execCommand('enableObjectResizing', false, 'false');

		// respond to clicks inside the editor
		this.quill.root.addEventListener('click', this.handleClick, false);
		this.quill.root.addEventListener('mscontrolselect', this.handleClick, false); //IE 11 support
		this.quill.root.addEventListener('scroll', this.handleScroll, false);
		this.quill.on('text-change', this.onUpdate);

		this.quill.root.parentNode.style.position = this.quill.root.parentNode.style.position || 'relative';

		// setup modules
		this.moduleClasses = this.options.modules;

		this.modules = [];
	}

	initializeModules = () => {
		this.removeModules();

		this.modules = this.moduleClasses.map(
			ModuleClass => new (knownModules[ModuleClass] || ModuleClass)(this),
		);

		this.modules.forEach(
			(module) => {
				module.onCreate();
			},
		);

		this.onUpdate();
	};

	onUpdate = () => {
		this.repositionElements();
		this.modules.forEach(
			(module) => {
				module.onUpdate();
			},
		);
	};

	removeModules = () => {
		this.modules.forEach(
			(module) => {
				module.onDestroy();
			},
		);

		this.modules = [];
	};

	handleClick = (evt) => {
		if (evt.target && evt.target.tagName && evt.target.tagName.toUpperCase() === 'IMG') {
			if (this.img === evt.target) {
				// we are already focused on this image
				return;
			}
			if (this.img) {
				// we were just focused on another image
				this.hide();
			}
			// clicked on an image inside the editor
			this.show(evt.target);
			evt.preventDefault(); //Prevent IE 11 drag handles appearing
		} else if (this.img) {
			// clicked on a non image
			this.hide();
		}
	};

	handleScroll = () => {
		//Hide the overlay when the editor is scrolled,
		//otherwise image is no longer correctly aligned with overlay
		this.hide();
	};

	show = (img) => {
		// keep track of this img element
		this.img = img;

		this.showOverlay();

		this.initializeModules();
	};

	showOverlay = () => {
		if (this.overlay) {
			this.hideOverlay();
		}

		this.quill.setSelection(null);

		// prevent spurious text selection
		this.setUserSelect('none');

		// listen for the image being deleted or moved
		document.addEventListener('keyup', this.checkImage, true);
		this.quill.root.addEventListener('input', this.checkImage, true);

		// Create and add the overlay
		this.overlay = document.createElement('div');
		Object.assign(this.overlay.style, this.options.overlayStyles);

		this.quill.root.parentNode.appendChild(this.overlay);

		this.repositionElements();
	};

	hideOverlay = () => {
		if (!this.overlay) {
			return;
		}

		// Remove the overlay
		this.quill.root.parentNode.removeChild(this.overlay);
		this.overlay = undefined;

		// stop listening for image deletion or movement
		document.removeEventListener('keyup', this.checkImage);
		this.quill.root.removeEventListener('input', this.checkImage);

		// reset user-select
		this.setUserSelect('');
	};

	repositionElements = () => {
		if (!this.overlay || !this.img) {
			return;
		}
		const scale = this.options.scale;
		const rotation = this.options.rotation;

		// position the overlay over the image
		const parent = this.quill.root.parentNode;
		const imgRect = this.img.getBoundingClientRect();
		const containerRect = parent.getBoundingClientRect();

		function degrees_to_radians(degrees)
		{
			const pi = Math.PI;
			return degrees * (pi/180);
		}


		 /*
		 * Calculates the angle ABC (in radians)
		 *
		 * A first point, ex: {x: 0, y: 0}
		 * C second point
		 * B center point
		 */
		function find_angle(A,B,C) {
			var AB = Math.sqrt(Math.pow(B.x-A.x,2)+ Math.pow(B.y-A.y,2));
			var BC = Math.sqrt(Math.pow(B.x-C.x,2)+ Math.pow(B.y-C.y,2));
			var AC = Math.sqrt(Math.pow(C.x-A.x,2)+ Math.pow(C.y-A.y,2));
			return Math.acos((BC*BC+AB*AB-AC*AC)/(2*BC*AB));
		}

		console.log('rotation = ', this.options.rotation);
		console.log('containerRect = ', containerRect);
		console.log('imgRect = ', imgRect);
		console.log('parent.scrollTop = ', parent.scrollTop);
		console.log('parent.scrollLeft = ', parent.scrollLeft);
		// const t = ;
		const t = degrees_to_radians(rotation);
		console.log('t = ', t);

		const tS =  rotation >= 0 ? t: -t

		// https://stackoverflow.com/questions/9971230/calculate-rotated-rectangle-size-from-known-bounding-box-coordinates
		const containerWidth = (1/(Math.pow(Math.cos(tS),2)-Math.pow(Math.sin(tS),2))) * (  containerRect.width * Math.cos(tS) - containerRect.height * Math.sin(tS))
		const containerHeight = (1/(Math.pow(Math.cos(tS),2)-Math.pow(Math.sin(tS),2))) * (- containerRect.width * Math.sin(tS) + containerRect.height * Math.cos(tS))
		const imgWidth = (1/(Math.pow(Math.cos(tS),2)-Math.pow(Math.sin(tS),2))) * (  imgRect.width * Math.cos(tS) - imgRect.height * Math.sin(tS))
		const imgHeight = (1/(Math.pow(Math.cos(tS),2)-Math.pow(Math.sin(tS),2))) * (- imgRect.width * Math.sin(tS) + imgRect.height * Math.cos(tS))

		// const containerScaleWidth = containerWidth/containerRect.width;
		// const containerScaleHeight = containerHeight/containerRect.height;
		// console.log('containerScaleWidth = ', containerScaleWidth);
		// console.log('containerScaleHeight = ', containerScaleHeight);

		// const imgScaleWidth = imgWidth/imgRect.width;
		// const imgScaleHeight = imgHeight/imgRect.height;
		// console.log('imgScaleWidth = ', imgScaleWidth);
		// console.log('imgScaleHeight = ', imgScaleHeight);

		const cx = containerHeight * Math.sin(tS);
		const cy = containerWidth * Math.sin(tS);
		const ix = imgHeight * Math.sin(tS);
		const iy = imgWidth * Math.sin(tS);

		console.log('containerWidth = ', containerWidth, containerHeight);
		console.log('cx = ', cx, cy);
		console.log('imgWidth ... = ', imgWidth, imgHeight);
		console.log('ix = ', ix, iy);

		const p1X = rotation >= 0 ? cx: 0;
		const p1Y = rotation < 0 ? cy: 0;
		const p2X = imgRect.left - containerRect.left + (rotation >= 0 ? ix: 0);
		const p2Y = imgRect.top - containerRect.top + (rotation < 0 ? iy: 0);

		console.log('p1X = ', p1X, p1Y);
		console.log('p2X = ', p2X, p2Y);
		const vX = (p2X - p1X);
		const vY = (p2Y - p1Y);
		console.log('vX = ', vX, vY);


		const rotLeft = vX * Math.cos(-t) - vY * Math.sin(-t);
		const rotTop = vX * Math.sin(-t) + vY * Math.cos(-t);
		console.log('rotLeft = ', rotLeft, rotTop);

		// const ncx = containerRect.left + cx;
		// const ncy = containerRect.top + cy;
		//
		// const nix = imgRect.left - containerRect.left + ix;
		// const niy = imgRect.top - containerRect.top + iy;
		//
		// console.log('nix = ', nix, niy);
		//
		// const lix = cx - nix;
		// const liy = cy - niy;
		//
		// console.log('lix = ', lix, liy);
		// console.log(imgWidth, imgHeight);
		// console.log(imgWidth * scale, imgHeight * scale);
		// const origLeft = imgRect.left - containerRect.left
		// const origTop = imgRect.top - containerRect.top
		//
		// const a = t - find_angle({x: origLeft, y: origTop}, {x:0, y: 0}, {x:0, y: 90});
		// console.log('a = ', a);
		//
		// console.log('origLeft = ', origLeft);
		// console.log('origTop = ', origTop);
		//
		// const rotLeft = origLeft * Math.cos(a) - origTop * Math.sin(a);
		// const rotTop = origLeft * Math.sin(a) + origTop * Math.cos(a);
		//
		// console.log('rotLeft = ', rotLeft);
		// console.log('rotTop = ', rotTop);
		// const matrix = new Matrix();
		// console.log('matrix.scale(containerRect.width, containerRect.height) = ', matrix.scale(containerRect.width, containerRect.height));
		// console.log('matrix = ', matrix
		// 	.rotate(t)
		// 	.scale(containerRect.width, containerRect.height)
			// .scale(containerScaleWidth, containerScaleHeight)
			// .applyToPoint(origLeft, origTop)
		// );
		// const z = matrix.scale(containerRect.width, containerRect.height).rotate(t).scale(containerScaleWidth, containerScaleHeight).applyToPoint(origLeft, origTop);
		// console.log('z.x = ', z.x, z.y);

		Object.assign(this.overlay.style, {
			// transform: `scale(${imgScaleWidth}, ${imgScaleHeight})`, //  translate(${rotLeft * scale}px, ${rotTop * scale}px)
			// top: '0px',
			// left: '0px',
			left: `${(rotLeft - 1 + parent.scrollLeft) * scale}px`,
			top: `${(rotTop + parent.scrollTop) * scale}px`,
			width: `${imgWidth * scale}px`,
			height: `${imgHeight * scale}px`,
		});

		// console.log('this.overlay.style = ', this.overlay.style);
	};

	hide = () => {
		this.hideOverlay();
		this.removeModules();
		this.img = undefined;
	};

	setUserSelect = (value) => {
		[
			'userSelect',
			'mozUserSelect',
			'webkitUserSelect',
			'msUserSelect',
		].forEach((prop) => {
			// set on contenteditable element and <html>
			this.quill.root.style[prop] = value;
			document.documentElement.style[prop] = value;
		});
	};

	checkImage = (evt) => {
		if (this.img) {
			if (evt.keyCode == 46 || evt.keyCode == 8) {
				(window.Quill || Quill).find(this.img).deleteAt(0);
			}
			this.hide();
		}
	};
}

if (window.Quill) {

	//BEGIN allow image alignment styles
	const ImageFormatAttributesList = [
		'alt',
		'height',
		'width',
		'style',
	];

	var BaseImageFormat = window.Quill.import('formats/image');
	class ImageFormat extends BaseImageFormat {
		static formats(domNode) {
			return ImageFormatAttributesList.reduce(function (formats, attribute) {
				if (domNode.hasAttribute(attribute)) {
					formats[attribute] = domNode.getAttribute(attribute);
				}
				return formats;
			}, {});
		}
		format(name, value) {
			if (ImageFormatAttributesList.indexOf(name) > -1) {
				if (value) {
					this.domNode.setAttribute(name, value);
				} else {
					this.domNode.removeAttribute(name);
				}
			} else {
				super.format(name, value);
			}
		}
	}

	window.Quill.register(ImageFormat, true);
	//END allow image alignment styles


	//Add support for IE 11
	if (typeof Object.assign != 'function') {
		Object.assign = function (target) {
			'use strict';
			if (target == null) {
				throw new TypeError('Cannot convert undefined or null to object');
			}

			target = Object(target);
			for (var index = 1; index < arguments.length; index++) {
				var source = arguments[index];
				if (source != null) {
					for (var key in source) {
						if (Object.prototype.hasOwnProperty.call(source, key)) {
							target[key] = source[key];
						}
					}
				}
			}
			return target;
		};
	}

	window.Quill.register('modules/imageResize', ImageResize);
}
