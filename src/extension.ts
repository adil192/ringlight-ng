import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { drawGlow, GLOW_FRACTION, RENDER_MAX } from './glow.js';
import { create_indicator } from './indicator.js';

export default class RinglightExtension extends Extension {
	declare _settings?: Gio.Settings;
	declare _area?: St.DrawingArea;
	declare _indicator?: PanelMenu.Button;
	declare _cameraMonitor?: Shell.CameraMonitor;
	declare _motionController?: Clutter.MotionController;
	declare _pointer?: { x: number; y: number };

	override enable() {
		const settings = (this._settings = this.getSettings());

		this._area = new St.DrawingArea({ reactive: false });
		this._area.connect('repaint', () => this._onRepaint());
		Main.layoutManager.addTopChrome(this._area, {
			trackFullscreen: false, // don't hide when an app is fullscreen
		});

		this._indicator = create_indicator(this);
		Main.panel.addToStatusArea(this.uuid, this._indicator);

		this._cameraMonitor = new Shell.CameraMonitor();
		this._cameraMonitor.connect_object(
			'notify::cameras-in-use',
			() => this._updateEnabledForAutoMode(),
			this,
		);

		Main.layoutManager.connect_object('monitors-changed', () => this._resize(), this);

		settings.connect_object('changed', () => this._queueRepaint(), this);
		settings.connect_object('changed::auto-mode', () => this._updateEnabledForAutoMode(), this);

		this._motionController = new Clutter.MotionController();
		this._motionController.connect('motion', (_, sprite) => {
			this._pointer = sprite.get_coords();
			if (this._area && this._area.visible) this._queueRepaint();
		});
		global.stage.add_action(this._motionController);

		this._resize();
		this._queueRepaint();
	}

	_updateEnabledForAutoMode() {
		if (!this._settings || !this._cameraMonitor) return;
		if (!this._settings.get_boolean('auto-mode')) return;

		const cameras_in_use = this._cameraMonitor.cameras_in_use;
		this._settings.set_boolean('enabled', cameras_in_use);
	}

	override disable() {
		if (this._motionController) global.stage.remove_action(this._motionController);
		delete this._motionController;

		this._cameraMonitor?.disconnect_object(this);
		delete this._cameraMonitor;

		Main.layoutManager.disconnect_object(this);

		this._settings?.disconnect_object(this);
		delete this._settings;

		this._indicator?.destroy();
		delete this._indicator;

		if (this._area) {
			Main.layoutManager.removeChrome(this._area);
			this._area.destroy();
			delete this._area;
		}
	}

	/**
	 * Sets {@link _area}'s position and size to match
	 * {@link Main.layoutManager.primaryMonitor}.
	 */
	_resize() {
		const monitor = Main.layoutManager.primaryMonitor;
		if (!monitor || !this._area) return;

		// Rendering time is O(n^2) in the long dimension,
		// so render no larger than RENDER_MAX pixels and let the GPU scale it up.
		const sf = Math.min(1, RENDER_MAX / Math.max(monitor.width, monitor.height));
		const w = Math.max(2, Math.round(monitor.width * sf));
		const h = Math.max(2, Math.round(monitor.height * sf));

		this._area.set_position(monitor.x, monitor.y);
		this._area.set_size(w, h);
		this._area.set_scale(monitor.width / w, monitor.height / h);
		this._area.queue_repaint();
	}

	_queueRepaint() {
		if (!this._area || !this._settings) return;

		this._area.visible = this._settings.get_boolean('enabled');
		this._area.queue_repaint();
	}

	_onRepaint() {
		if (!this._area || !this._settings) return;

		const monitor = Main.layoutManager.primaryMonitor;
		if (!monitor) return;

		const context = this._area.get_context();
		try {
			const [width, height] = this._area.get_surface_size();
			if (width < 1 || height < 1) return;

			const pointer_x = this._pointer ? (this._pointer.x - monitor.x) / monitor.width : null;
			const pointer_y = this._pointer ? (this._pointer.y - monitor.y) / monitor.height : null;

			drawGlow(context, width, height, pointer_x, pointer_y, {
				brightness: this._settings.get_double('brightness'),
				colorTemp: this._settings.get_double('color-temp'),
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				glowSize: this._settings.get_string('glow-size') as keyof typeof GLOW_FRACTION,
			});
		} finally {
			context.$dispose();
		}
	}
}
