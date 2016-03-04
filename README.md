qrextract
=========

Extract QR codes from images for further processing.

It is written in the first hand as a preprocessor for zbarimg, unable to scan efficiently small QR codes in full page documents.

Usage
-----

	var fs = require("fs");
	var jpeg = require("jpeg-js");
	var qrextract = require("qrextract");
	
	var inputImg = jpeg.decode(fs.readFileSync("input.jpeg"));

	qrextract.extract(inputImg).forEach((outputImg, index) => {
		var filename = outputPrefix+'00'.slice(0,-index.toString().length)+index+'.jpg';
		fs.writeFile(filename, jpeg.encode(outputImg, 100).data);
	});

