const pointerEvent = function(scene, player) {
	const pointerPos = {x: 0, y: 0};

	scene.input.on("pointerdown", function(pointer) {
		pointerPos.x = pointer.x;
		pointerPos.y = pointer.y;
	});
	scene.input.on("pointerup", function() {
		pointerPos.x = 0;
		pointerPos.y = 0;
	});
	scene.input.on("pointermove", function(pointer) {
		if (!pointer.isDown) return;
		if (pointer.button != 0) return;
		const {x, y} = pointer;

		const move = {
			x: pointerPos.x - x,
			y: pointerPos.y - y,
		};
		player.body.setVelocityX(move.x * 125);
		player.body.setVelocityY(move.y * 125);

		pointerPos.x = x;
		pointerPos.y = y;
	});
}
