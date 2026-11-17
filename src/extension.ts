import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
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
	private _fadeTransition?: Clutter.PropertyTransition;
	declare _indicator?: PanelMenu.Button;
	declare _cameraMonitor?: Shell.CameraMonitor;
	declare _pointer?: { x: number; y: number } | null;

	override enable() {
		const settings = (this._settings = this.getSettings());

		this._area = new St.DrawingArea({ reactive: false, opacity: 0, visible: false });
		this._area.connect('repaint', () => this._onRepaint());
		Main.layoutManager.addTopChrome(this._area, {
			trackFullscreen: false, // don't hide when an app is fullscreen
		});

		this._fadeTransition = Clutter.PropertyTransition.new_for_actor(this._area, 'opacity');
		this._fadeTransition.set_from(0);
		this._fadeTransition.set_to(255);
		this._fadeTransition.set_duration(1000);
		this._fadeTransition.set_progress_mode(Clutter.AnimationMode.EASE_IN_OUT_QUAD);
		this._fadeTransition.stop();
		this._fadeTransition.add_marker_at_time('transparent', 0);
		this._fadeTransition.connect('marker-reached::transparent', transition => {
			if (transition.direction === Clutter.TimelineDirection.BACKWARD) {
				this._area!.visible = false;
			}
		});
		this._area.add_transition('fadeTransition', this._fadeTransition);

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

		const cursorTracker = global.backend.get_cursor_tracker();
		cursorTracker.connect_object(
			'position-invalidated',
			() => this._updateCursor(cursorTracker),
			this,
		);
		cursorTracker.connect_object(
			'visibility-changed',
			() => this._updateCursor(cursorTracker),
			this,
		);

		this._updateEnabledForAutoMode();
		this._resize();
		this._updateCursor(cursorTracker);
	}

	_updateCursor(cursorTracker: Meta.CursorTracker) {
		if (cursorTracker.get_pointer_visible()) {
			[this._pointer] = cursorTracker.get_pointer();
		} else {
			this._pointer = undefined;
		}
		if (this._area && this._area.visible) this._queueRepaint();
	}
	_updateEnabledForAutoMode() {
		if (!this._settings || !this._cameraMonitor) return;
		if (!this._settings.get_boolean('auto-mode')) return;

		const cameras_in_use = this._cameraMonitor.cameras_in_use;
		this._settings.set_boolean('enabled', cameras_in_use);
	}

	override disable() {
		const cursorTracker = global.backend.get_cursor_tracker();
		cursorTracker.disconnect_object(this);
		this._pointer = undefined;

		this._cameraMonitor?.disconnect_object(this);
		this._cameraMonitor = undefined;

		Main.layoutManager.disconnect_object(this);

		this._settings?.disconnect_object(this);
		this._settings = undefined;

		this._indicator?.destroy();
		this._indicator = undefined;

		if (this._area) {
			Main.layoutManager.removeChrome(this._area);
			this._area.remove_all_transitions();
			this._area.destroy();
		}
		this._fadeTransition = undefined;
		this._area = undefined;
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

	/** Fades the actor in/out if needed and queues a repaint */
	_queueRepaint() {
		if (!this._area || !this._settings || !this._fadeTransition) return;

		const enabled = this._settings.get_boolean('enabled');
		if (enabled) {
			if (!this._area.visible || this._area.opacity < 255) {
				const wasVisible = this._area.visible;
				this._area.visible = true;
				this._fadeTransition.set_direction(Clutter.TimelineDirection.FORWARD);
				if (!wasVisible) this._fadeTransition.rewind();
				this._fadeTransition.start();
			}
		} else {
			if (this._area.visible) {
				this._fadeTransition.set_direction(Clutter.TimelineDirection.BACKWARD);
				this._fadeTransition.start();
			}
		}

		this._area.queue_repaint();
	}

	/** Paints the ringlight. Call _queueRepaint instead of using this method directly.  */
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
