let showDebug = false;

const main = function({
	mode="tester",
	step=0,
	sim_code="",
	sec_per_step=10,
	play_speed=32,
	persona_init_pos="{}",
	all_movement="{}",
	start_datetime="",
	static="/static/",
	path_tester_update="/",
	update_environment="/",
	process_environment="/",
}) {
	/*
	  Main resources:
	  https://www.youtube.com/watch?v=cKIG1lKwLeo&t=401s&ab_channel=HongLy
	  For the ground zero code, see the exported files from here:
	  https://codepen.io/mikewesthad/pen/BVeoYP?editors=1111

	  Also worth taking a look:
	  https://www.youtube.com/watch?v=fdXcD9X4NrQ&ab_channel=MorganPage
	  and
	  https://www.youtube.com/watch?v=MR2CvWxOEsw&ab_channel=MattWilber
	 */

	// ###########################################################################
	// PREAMBLE
	// ###########################################################################

	// <step> -- one full loop around all three phases determined by <phase> is
	// a step. We use this to link the steps in the backend.
	step = step*1;
	sim_code = sim_code+"";
	let step_size = (sec_per_step || 10) * 1000; // 10 seconds = 10000

	mode = mode === "simulate" ? "replay" : mode;
	mode = ["tester", "demo", "replay"].includes(mode) ? mode : "tester";
	const playerDepth = mode === "tester" ? 1 : -1;

	// Phaser 3.0 global settings.
	// Configuration meant to be passed to the main Phaser game instance.
	const canvas_width = Math.min(1500, document.querySelector("#game-container").clientWidth);
	const config = {
		type: Phaser.AUTO,
		width: canvas_width,
		height: canvas_width * 9/16,
		parent: "game-container",
		pixelArt: true,
		physics: {
			default: "arcade",
			arcade: {
				gravity: {
					y: 0,
				},
			},
		},
		scene: {
			preload: preload,
			create: create,
			update: update,
		},
		scale: {
			zoom: 1.0,
		},
	};


	// Creating the game instance and setting up the main Phaser variables that
	// will be used in it.
	const game = new Phaser.Game(config);
	let cursors;
	let player;

	// Persona related variables. This should have the name of the persona as its
	// keys, and the instances of the Persona class as the values.
	// let persona_names = persona_init_pos;
	// let spawn_tile_loc = {};
	// for (let key in persona_names) {
	// 	spawn_tile_loc[key] = persona_names[key];
	// }
	persona_init_pos = JSON.parse(persona_init_pos);

	let personas = {};
	let pronunciatios = {};
	let speech_bubbles = {};
	let anims_direction;
	let pre_anims_direction;
	let pre_anims_direction_dict = {};

	curr_maze = "the_ville";

	// <tile_width> is the width of one individual tile (tiles are square)
	tile_width = 32;
	// Important: tile_width % movement_speed has to be 0.
	// <movement_speed> determines how fast we move at each upate cylce.
	let movement_speed = play_speed*1;

	// <timer_max> determines how frequently our update function will query the
	// frontend server. If it's higher, we wait longer cycles.
	let timer_max = 0;
	let timer = timer_max;

	// <phase> -- there are three phases: "process," "update," and "execute."
	let phase = "update"; // or "update" or "execute"

	// Variables for storing movements that are sent from the backend server.
	let execute_movement;
	let execute_count_max = tile_width / movement_speed;
	let execute_count = execute_count_max;
	let movement_target = {};
	all_movement = JSON.parse(all_movement);

	let datetime_options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
	if (start_datetime) {
		start_datetime = new Date(Date.parse(start_datetime));
		document.getElementById("game-time-content").innerHTML = start_datetime.toLocaleTimeString("en-US", datetime_options);
	}

	// Control button binders
	let play_button = document.getElementById("play_button");
	let pause_button = document.getElementById("pause_button");


	// ###########################################################################
	// ENGINE
	// ###########################################################################

	// Joon: Phaser 3.0 is oriented around "scenes" -- recall how Pokemon plays:
	//       there is the outdoor space, and then there is the indoor space; when
	//       you go inside, you transition to a new "scene" and the outdoor space
	//       basically disappears.
	//       A scene in Phaser has four key methods that are called at different
	//       stages of rendering for different purposes. They are:
	//       init() -> preload() -> create() -> update()
	//           init() is called only once at the very beginning. This is the
	//               initialization function in case that is needed.
	//           preload() is called once and preloads any of the assets
	//           create() is also called once after preloading... creates sprites
	//               and actually displays stuff
	//           update() is called on each frame during the game play

	function preload() {
		// For managing cross origin errors. We need to set this, change AWS
		// CORS settings, and django AWS settings.
		this.load.crossOrigin = '';

		// Loading the necessary images (e.g., the background image, character
		// sprites).
		// Joon: for load.image, the first parameter is simply the key value that
		//       you are passing in. The second parameter should be pointed to the
		//       png file that contains the tileset.
		//       Also IMPORTANT: when you create a tileset in Tiled, always be
		//       sure to check the "embedded" option.
		this.load.image("blocks_1", static + "assets/the_ville/visuals/map_assets/blocks/blocks_1.png");
		this.load.image("walls", static + "assets/the_ville/visuals/map_assets/v1/Room_Builder_32x32.png");
		this.load.image("interiors_pt1", static + "assets/the_ville/visuals/map_assets/v1/interiors_pt1.png");
		this.load.image("interiors_pt2", static + "assets/the_ville/visuals/map_assets/v1/interiors_pt2.png");
		this.load.image("interiors_pt3", static + "assets/the_ville/visuals/map_assets/v1/interiors_pt3.png");
		this.load.image("interiors_pt4", static + "assets/the_ville/visuals/map_assets/v1/interiors_pt4.png");
		this.load.image("interiors_pt5", static + "assets/the_ville/visuals/map_assets/v1/interiors_pt5.png");
		this.load.image("CuteRPG_Field_B", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_B.png");
		this.load.image("CuteRPG_Field_C", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_C.png");
		this.load.image("CuteRPG_Harbor_C", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Harbor_C.png");
		this.load.image("CuteRPG_Village_B", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Village_B.png");
		this.load.image("CuteRPG_Forest_B", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_B.png");
		this.load.image("CuteRPG_Desert_C", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_C.png");
		this.load.image("CuteRPG_Mountains_B", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Mountains_B.png");
		this.load.image("CuteRPG_Desert_B", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_B.png");
		this.load.image("CuteRPG_Forest_C", static + "assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_C.png");

		// Joon: This is the export json file you get from Tiled.
		this.load.tilemapTiledJSON("map", static + "assets/the_ville/visuals/the_ville_jan7.json");

		// An atlas is a way to pack multiple images together into one texture. I'm
		// using it to load all the player animations (walking left, walking right,
		// etc.) in one image. For more info see:
		// https://labs.phaser.io/view.html?src=src/animation/texture%20atlas%20animation.js
		// If you don't use an atlas, you can do the same thing with a spritesheet,
		// see: https://labs.phaser.io/view.html?src=src/animation/single%20sprite%20sheet.js
		// Joon: Technically, I think this guy had the best tutorial for atlas:
		//       https://www.youtube.com/watch?v=fdXcD9X4NrQ&ab_channel=MorganPage
		this.load.atlas(
			"atlas",
			"https://mikewesthad.github.io/phaser-3-tilemap-blog-posts/post-1/assets/atlas/atlas.png",
			"https://mikewesthad.github.io/phaser-3-tilemap-blog-posts/post-1/assets/atlas/atlas.json",
		);

		for (let p_name in persona_init_pos) {
			this.load.atlas(
				p_name,
				static + `assets/characters/${p_name}.png`,
				static + "assets/characters/atlas.json",
			);
		}

		this.load.image('speech_bubble', static + "assets/speech_bubble/v3.png");

		// *** SETUP PLAY AND PAUSE BUTTON ***
		let play_context = this;
		if (play_button) play_button.onclick = function() {
			play_context.scene.resume();
		};
		if (pause_button) pause_button.onclick = function() {
			play_context.scene.pause();
		};
	}


	function create() {
		const map = this.make.tilemap({ key: "map" });
		// Joon: Logging map is really helpful for debugging here:
		//       console.log(map);

		// The first parameter is the name you gave to the tileset in Tiled and then
		// the key of the tileset image in Phaser's cache (i.e. the name you used in
		// preload)
		// Joon: for the first parameter here, really take a look at the
		//       console.log(map) output. You need to make sure that the name
		//       matches.
		const collisions = map.addTilesetImage("blocks", "blocks_1");
		const walls = map.addTilesetImage("Room_Builder_32x32", "walls");
		const interiors_pt1 = map.addTilesetImage("interiors_pt1", "interiors_pt1");
		const interiors_pt2 = map.addTilesetImage("interiors_pt2", "interiors_pt2");
		const interiors_pt3 = map.addTilesetImage("interiors_pt3", "interiors_pt3");
		const interiors_pt4 = map.addTilesetImage("interiors_pt4", "interiors_pt4");
		const interiors_pt5 = map.addTilesetImage("interiors_pt5", "interiors_pt5");
		const CuteRPG_Field_B = map.addTilesetImage("CuteRPG_Field_B", "CuteRPG_Field_B");
		const CuteRPG_Field_C = map.addTilesetImage("CuteRPG_Field_C", "CuteRPG_Field_C");
		const CuteRPG_Harbor_C = map.addTilesetImage("CuteRPG_Harbor_C", "CuteRPG_Harbor_C");
		const CuteRPG_Village_B = map.addTilesetImage("CuteRPG_Village_B", "CuteRPG_Village_B");
		const CuteRPG_Forest_B = map.addTilesetImage("CuteRPG_Forest_B", "CuteRPG_Forest_B");
		const CuteRPG_Desert_C = map.addTilesetImage("CuteRPG_Desert_C", "CuteRPG_Desert_C");
		const CuteRPG_Mountains_B = map.addTilesetImage("CuteRPG_Mountains_B", "CuteRPG_Mountains_B");
		const CuteRPG_Desert_B = map.addTilesetImage("CuteRPG_Desert_B", "CuteRPG_Desert_B");
		const CuteRPG_Forest_C = map.addTilesetImage("CuteRPG_Forest_C", "CuteRPG_Forest_C");

		// The first parameter is the layer name (or index) taken from Tiled, the
		// second parameter is the tileset you set above, and the final two
		// parameters are the x, y coordinate.
		// Joon: The "layer name" that comes as the first parameter value
		//       literally is taken from our Tiled layer name. So to find out what
		//       they are; you actually need to open up tiled and see how you
		//       named things there.
		let tileset_group_1 = [
			CuteRPG_Field_B, CuteRPG_Field_C, CuteRPG_Harbor_C, CuteRPG_Village_B,
			CuteRPG_Forest_B, CuteRPG_Desert_C, CuteRPG_Mountains_B, CuteRPG_Desert_B, CuteRPG_Forest_C,
			interiors_pt1, interiors_pt2, interiors_pt3, interiors_pt4, interiors_pt5, walls
		];
		const bottomGroundLayer = map.createLayer("Bottom Ground", tileset_group_1, 0, 0);
		const exteriorGroundLayer = map.createLayer("Exterior Ground", tileset_group_1, 0, 0);
		const exteriorDecorationL1Layer = map.createLayer("Exterior Decoration L1", tileset_group_1, 0, 0);
		const exteriorDecorationL2Layer = map.createLayer("Exterior Decoration L2", tileset_group_1, 0, 0);
		const interiorGroundLayer = map.createLayer("Interior Ground", tileset_group_1, 0, 0);
		const wallLayer = map.createLayer("Wall", [CuteRPG_Field_C, walls], 0, 0);
		const interiorFurnitureL1Layer = map.createLayer("Interior Furniture L1", tileset_group_1, 0, 0);
		const interiorFurnitureL2Layer = map.createLayer("Interior Furniture L2 ", tileset_group_1, 0, 0);
		const foregroundL1Layer = map.createLayer("Foreground L1", tileset_group_1, 0, 0);
		const foregroundL2Layer = map.createLayer("Foreground L2", tileset_group_1, 0, 0);

		const collisionsLayer = map.createLayer("Collisions", collisions, 0, 0);
		// const groundLayer = map.createLayer("Ground", walls, 0, 0);
		// const indoorGroundLayer = map.createLayer("Indoor Ground", walls, 0, 0);
		// const wallsLayer = map.createLayer("Walls", walls, 0, 0);
		// const interiorsLayer = map.createLayer("Furnitures", interiors, 0, 0);
		// const builtInLayer = map.createLayer("Built-ins", interiors, 0, 0);
		// const appliancesLayer = map.createLayer("Appliances", interiors, 0, 0);
		// const foregroundLayer = map.createLayer("Foreground", interiors, 0, 0);

		// Joon: This is where you want to create a custom field for the tileset
		//       in Tiled. Take a look at this guy's tutorial:
		//       https://www.youtube.com/watch?v=MR2CvWxOEsw&ab_channel=MattWilber
		collisionsLayer.setCollisionByProperty({ collide: true });
		// By default, everything gets depth sorted on the screen in the order we
		// created things. Here, we want the "Above Player" layer to sit on top of
		// the player, so we explicitly give it a depth. Higher depths will sit on
		// top of lower depth objects.
		// Collisions layer should get a negative depth since we do not want to see
		// it.
		collisionsLayer.setDepth(playerDepth);
		foregroundL1Layer.setDepth(2);
		foregroundL2Layer.setDepth(2);

		// *** SET UP CAMERA ***
		// "player" is to be set as the center of mass for our "camera." We
		// basically create a game character sprite as we would for our personas
		// but we move it to depth -1 and let it pass through the collision map;
		// that is, do not have the following line:
		// this.physics.add.collider(player, collisionsLayer);
		// OLD NOTE: Create a sprite with physics enabled via the physics system.
		// The image  used for the sprite has a bit of whitespace, so I'm using
		// setSize & setOffset to control the size of the player's body.
		player = this.physics.add.sprite(2400, 588, "atlas", "misa-front").setSize(30, 40).setOffset(0, 0);
		player.setDepth(playerDepth);
		// Setting up the camera.
		const camera = this.cameras.main;
		camera.startFollow(player);
		camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
		cursors = this.input.keyboard.createCursorKeys();


		// *** MOVE CAMERA WITH POINTER ***
		// Move the "camera" through pointer moving.
		const pointerPos = {};
		this.input.on("pointerup", function() {
			pointerPos.x = 0;
			pointerPos.y = 0;
		});
		this.input.on("pointermove", function(pointer) {
			if (!pointer.isDown) return;
			if (pointer.button != 0) return;
			const {x, y, downX, downY} = pointer;
	
			const move = {
				x: (pointerPos.x || downX) - x,
				y: (pointerPos.y || downY) - y,
			};
			player.body.setVelocity(move.x * 125, move.y * 125);
	
			pointerPos.x = x;
			pointerPos.y = y;
		});


		// *** SET UP PERSONAS ***
		// We start by creating the game sprite objects.
		for (let i=0; i<Object.keys(persona_init_pos).length; i++) {
			let persona_name = Object.keys(persona_init_pos)[i];
			let start_pos = [
				persona_init_pos[persona_name][0] * tile_width + tile_width / 2,
				persona_init_pos[persona_name][1] * tile_width + tile_width,
			];
			let new_sprite = this.physics.add.sprite(start_pos[0], start_pos[1], persona_name, "down").setSize(30, 40).setOffset(0, 16);
			// Scale up the sprite
			new_sprite.displayWidth = 40;
			new_sprite.scaleY = new_sprite.scaleX;

			// Here, we are creating the persona and its pronunciatio sprites.
			personas[persona_name] = new_sprite;
			speech_bubbles[persona_name] = this.add.image(new_sprite.body.x - 0, new_sprite.body.y - 30, 'speech_bubble').setDepth(3);
			speech_bubbles[persona_name].displayWidth = 140;
			speech_bubbles[persona_name].displayHeight = 58;

			pronunciatios[persona_name] = this.add.text(
				new_sprite.body.x - 6,
				new_sprite.body.y - 42 - 16,
				"🦁", {
					font: "24px monospace",
					fill: "#000000",
					padding: {
						x: 8,
						y: 8,
					},
					border: "solid",
					borderRadius: "10px",
				},
			).setDepth(3);
		}

		// Create the player's walking animations from the texture atlas. These are
		// stored in the global animation manager so any sprite can access them.
		const anims = this.anims;
		for (let i=0; i<Object.keys(persona_init_pos).length; i++) {
			let persona_name = Object.keys(persona_init_pos)[i];
			let left_walk_name = persona_name + "-left-walk";
			let right_walk_name = persona_name + "-right-walk";
			let down_walk_name = persona_name + "-down-walk";
			let up_walk_name = persona_name + "-up-walk";

			console.log(persona_name, left_walk_name, "DEUBG")
			anims.create({
				key: left_walk_name,
				frames: anims.generateFrameNames(persona_name, { prefix: "left-walk.", start: 0, end: 3, zeroPad: 3 }),
				frameRate: 4,
				repeat: -1,
			});

			anims.create({
				key: right_walk_name,
				frames: anims.generateFrameNames(persona_name, { prefix: "right-walk.", start: 0, end: 3, zeroPad: 3 }),
				frameRate: 4,
				repeat: -1,
			});

			anims.create({
				key: down_walk_name,
				frames: anims.generateFrameNames(persona_name, { prefix: "down-walk.", start: 0, end: 3, zeroPad: 3 }),
				frameRate: 4,
				repeat: -1,
			});

			anims.create({
				key: up_walk_name,
				frames: anims.generateFrameNames(persona_name, { prefix: "up-walk.", start: 0, end: 3, zeroPad: 3 }),
				frameRate: 4,
				repeat: -1,
			});
		}
	}


	function update(time, delta) {
		// *** MOVE CAMERA ***
		// This is where we finish up the camera setting we started in the create()
		// function. We set the movement speed of the camera and wire up the keys to
		// map to the actual movement.
		const camera_speed = 400;
		// Stop any previous movement from the last frame
		player.body.setVelocity(0);
		if (cursors.left.isDown) {
			player.body.setVelocityX(-camera_speed);
		}
		if (cursors.right.isDown) {
			player.body.setVelocityX(camera_speed);
		}
		if (cursors.up.isDown) {
			player.body.setVelocityY(-camera_speed);
		}
		if (cursors.down.isDown) {
			player.body.setVelocityY(camera_speed);
		}

		// Run a separate function for each mode
		if (mode in updates) {
			updates[mode]();
		}
	}


	// Separate function for each mode
	const updates = {
		tester: function() {
			// *** MOVE PERSONAS ***
			// Moving personas take place in three distinct phases: "process," "update,"
			// and "execute." These phases are determined by the value of <phase>.
			// Only one of the three phases is incurred in each update cycle.
			let data = {
				"camera": {
					"maze": curr_maze,
					"x": player.body.position.x,
					"y": player.body.position.y,
				},
			}
			post(path_tester_update, data);
		},


		demo: function() {
			let curr_focused_persona = document.getElementById("temp_focus").textContent;
			if (curr_focused_persona != "") {
				player.body.x = personas[curr_focused_persona].body.x;
				player.body.y = personas[curr_focused_persona].body.y;
				document.getElementById("temp_focus").innerHTML = "";
			}


			// *** MOVING PERSONAS ***
			if (execute_count == 0) start_datetime = new Date(start_datetime.getTime() + step_size);
			action(all_movement[step], start_datetime);
		},


		replay: function() {
			// *** MOVE PERSONAS ***
			// Moving personas take place in three distinct phases: "process," "update,"
			// and "execute." These phases are determined by the value of <phase>.
			// Only one of the three phases is incurred in each update cycle.
			if (phase == "process") {
				// "process" takes all current locations of the personas and send them to
				// the frontend server in a json form. Here, we first create the json
				// file that records all persona locations:
				let data = {
					"step": step,
					"sim_code": sim_code,
					"environment": {},
				}
				for (let i=0; i<Object.keys(personas).length; i++) {
					let persona_name_os = Object.keys(personas)[i];
					let persona_name = persona_name_os.replace(/_/g, " ");
					data["environment"][persona_name] = {
						"maze": curr_maze,
						"x": Math.ceil((personas[persona_name_os].body.position.x) / tile_width),
						"y": Math.ceil((personas[persona_name_os].body.position.y) / tile_width),
					}
				}
				post(process_environment, data);

				// Finally, we update the phase variable to start the "udpate" process.
				// Now that we sent all persona locations to the backend server, we need
				// to wait until the backend determines what the personas will do next.
				phase = "update";
			}


			else if (phase == "update") {
				// Update is where we * wait * for the backend server to finish
				// computing about what the personas will do next given their current
				// situation.
				// We do this by continuously asking the backend server if it is ready.
				// The backend server is ready when it returns a json that has a key-val
				// pair with "<move>": true.
				// Note that we do not want to overburden the backend too much by
				// over-querying; so, we have a timer set so we only query it once every
				// timer_max cycles.
				if (timer <= 0) {
					const data = {
						"step": step,
						"sim_code": sim_code,
					}
					post(update_environment, data, function(xhr) {
						if (JSON.parse(xhr.responseText)["<step>"] == step) {
							execute_movement = JSON.parse(xhr.responseText)
							phase = "execute";
						}
						timer = timer_max;
					});
				}
				timer -= 1;
			}


			else { // phase == execute
				// This is where we actually move the personas in the visual world. Each
				// backend computation in execute_movement moves each persona by one tile
				// (or some personas might not move if they choose not to).
				// The execute_count_max is computed by tile_width/movement_speed, which
				// defines a one step sequence in this world.
				let curr_time = new Date(execute_movement["meta"]["curr_time"]);
				action(execute_movement["persona"], curr_time);
			}
		},
	}


	const action = function(movements, curr_time) {
		if (!movements) return;

		if (curr_time) document.getElementById("game-time-content").innerHTML = curr_time.toLocaleTimeString("en-US", datetime_options);
		for (let i=0; i<Object.keys(personas).length; i++) {
			let curr_persona_name_os = Object.keys(personas)[i];
			let curr_persona_name = curr_persona_name_os.replace(/_/g, " ");
			let curr_persona = personas[curr_persona_name_os];
			let curr_pronunciatio = pronunciatios[Object.keys(personas)[i]];
			let curr_speech_bubble = speech_bubbles[Object.keys(personas)[i]];

			let p_movement = movements[curr_persona_name];
			if (p_movement) {
				if (execute_count == execute_count_max) {
					let curr_x = p_movement["movement"][0];
					let curr_y = p_movement["movement"][1];
					movement_target[curr_persona_name_os] = [curr_x * tile_width, curr_y * tile_width];

					// Updating the status of each personas
					// setText(p_movement, curr_persona_name_os);
					let pronunciatio_content = p_movement["pronunciatio"];
					let description_content = p_movement["description"];
					let chat_content_raw = p_movement["chat"];
			
					// This is what gives the pronunciatio balloon the name initials. We
					// use regex to extract the initials of the personas.
					// E.g., "Dolores Murphy" -> "DM"
					let rgx = new RegExp(/(\p{L}{1})\p{L}+/, 'gu');
					let initials = [...curr_persona_name.matchAll(rgx)] || [];
					initials = (
						(initials.shift()?.[1] || '') + (initials.pop()?.[1] || '')
					).toUpperCase();
					pronunciatios[curr_persona_name_os].setText(initials + ": " + pronunciatio_content);
			
					let chat_content = "";
					if (chat_content_raw != null) {
						for (let j=0; j<chat_content_raw.length; j++) {
							chat_content += chat_content_raw[j][0] + ": " + chat_content_raw[j][1] + "<br>"
						}
					} else {
						chat_content = "<em>None at the moment</em>"
					}
			
					// Filling in the action description.
					document.getElementById("quick_emoji-" + curr_persona_name_os).innerHTML = pronunciatio_content;
					document.getElementById("current_action__" + curr_persona_name_os).innerHTML = description_content.split("@")[0];
					document.getElementById("target_address__" + curr_persona_name_os).innerHTML = description_content.split("@")[1];
					document.getElementById("chat__" + curr_persona_name_os).innerHTML = chat_content;
				}

				if (execute_count > 0) {
					if (!animation.start(curr_persona, curr_pronunciatio, curr_speech_bubble, curr_persona_name_os)) {
						animation.stop(curr_persona, curr_persona_name_os);
					};
				} else if (mode != "demo") {
					move_personas();
					phase = "process";
				}
			} else {
				animation.stop(curr_persona, curr_persona_name_os);
			}
		}

		if (mode == "demo" && execute_count == 0) {
			move_personas();
		}

		execute_count -= 1;
	}


	const move_personas = function() {
		// Once we are done moving the personas, we move on to the "process"
		// stage where we will send the current locations of all personas at the
		// end of the movemments to the frontend server, and then the backend.
		for (let i=0; i<Object.keys(personas).length; i++) {
			let curr_persona_name_os = Object.keys(personas)[i];
			let curr_persona = personas[curr_persona_name_os];
			curr_persona.body.x = movement_target[curr_persona_name_os][0];
			curr_persona.body.y = movement_target[curr_persona_name_os][1];
		}
		execute_count = execute_count_max + 1;
		step = step + 1;
	}


	const post = function(url, data, callback) {
		let json = JSON.stringify(data);
		// We then send this to the frontend server:
		let xhr = new XMLHttpRequest();
		xhr.overrideMimeType("application/json");
		xhr.open('POST', url, true);
		xhr.addEventListener("load", function() {
			if (this.readyState === 4) {
				if (xhr.status === 200) {
					if (typeof callback === "function") {
						callback(xhr);
					}
				}
			}
		});
		xhr.send(json);
	}


	const animation = {
		start: function(curr_persona, curr_pronunciatio, curr_speech_bubble, p_name_os) {
			if (curr_persona.body.x < movement_target[p_name_os][0]) {
				curr_persona.body.x += movement_speed;
				anims_direction = "r";
				pre_anims_direction = "r"
				pre_anims_direction_dict[p_name_os] = "r"
			} else if (curr_persona.body.x > movement_target[p_name_os][0]) {
				curr_persona.body.x -= movement_speed;
				anims_direction = "l";
				pre_anims_direction = "l"
				pre_anims_direction_dict[p_name_os] = "l"
			} else if (curr_persona.body.y < movement_target[p_name_os][1]) {
				curr_persona.body.y += movement_speed;
				anims_direction = "d";
				pre_anims_direction = "d"
				pre_anims_direction_dict[p_name_os] = "d"
			} else if (curr_persona.body.y > movement_target[p_name_os][1]) {
				curr_persona.body.y -= movement_speed;
				anims_direction = "u";
				pre_anims_direction = "u"
				pre_anims_direction_dict[p_name_os] = "u"
			} else {
				anims_direction = "";
			}
	
			curr_pronunciatio.x = curr_persona.body.x + 18;
			curr_pronunciatio.y = curr_persona.body.y - 42 - 28;
			curr_speech_bubble.x = curr_persona.body.x + 80;
			curr_speech_bubble.y = curr_persona.body.y - 39;
	
			let left_walk_name = p_name_os + "-left-walk";
			let right_walk_name = p_name_os + "-right-walk";
			let down_walk_name = p_name_os + "-down-walk";
			let up_walk_name = p_name_os + "-up-walk";
			if (anims_direction == "l") {
				curr_persona.anims.play(left_walk_name, true);
			} else if (anims_direction == "r") {
				curr_persona.anims.play(right_walk_name, true);
			} else if (anims_direction == "u") {
				curr_persona.anims.play(up_walk_name, true);
			} else if (anims_direction == "d") {
				curr_persona.anims.play(down_walk_name, true);
			} else {
				return false;
			}
		},
		stop: function(curr_persona, p_name_os) {
			curr_persona.anims.stop();
	
			// If we were moving, pick an idle frame to use
			if (pre_anims_direction_dict[p_name_os] == "l") curr_persona.setTexture(p_name_os, "left"); else
			if (pre_anims_direction_dict[p_name_os] == "r") curr_persona.setTexture(p_name_os, "right"); else
			if (pre_anims_direction_dict[p_name_os] == "u") curr_persona.setTexture(p_name_os, "up"); else
			if (pre_anims_direction_dict[p_name_os] == "d") curr_persona.setTexture(p_name_os, "down");
		}
	}


	return game;
}
