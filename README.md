# qrextract

Extract QR codes from images for further processing.

It is designed to be used as a preprocessor, for zbarimg for example, which is unable to scan efficiently small QR codes from full page documents.

When looking for specific QR codes of an already known version, specifying this version with `codeVersionMin` and/or `codeVersionMax` options will always be faster (see "Usage" below for example).

## Usage

Extract `input.jpeg` version 1 QR codes to `code_xxx.jpg` files:

```js
const fs = require("fs")
const jpeg = require("jpeg-js")
const qrextract = require("qrextract")

var inputImg = jpeg.decode(fs.readFileSync("input.jpeg"))

qrextract.everyCodeImage(inputImg, function(outputImg, index) {
	var filename = 'code_000'.slice(0,-index.toString().length)+index+'.jpg'
	fs.writeFileSync(filename, jpeg.encode(outputImg, 100).data)
	return true
}, {
	codeVersionMax: 1,
})
```

Draw a red box around `input.jpeg` possible QR code marks and write the result to `output.jpg`:

```js
const fs = require("fs")
const jpeg = require("jpeg-js")
const qrextract = require("qrextract")

var inputImg = jpeg.decode(fs.readFileSync("input.jpeg"))

qrextract.everyMarkBoundingBox(inputImg, function(box, index) {
	for(var x = box.min.x; x <= box.max.x; x++) {
		for(var y = -1; y <= 1; y++) {
			[255, 0, 0].forEach(function(v, i) {
				inputImg.data[((box.min.y + y) * inputImg.width + x) * 4 + i] = v
				inputImg.data[((box.max.y + y) * inputImg.width + x) * 4 + i] = v
			})
		}
	}
	for(var y = box.min.y; y <= box.max.y; y++) {
		for(var x = -1; x <= 1; x++) {
			[255, 0, 0].forEach(function(v, i) {
				inputImg.data[(y * inputImg.width + (box.min.x+x)) * 4 + i] = v
				inputImg.data[(y * inputImg.width + (box.max.x+x)) * 4 + i] = v
			})
		}
	}
	return true
}, {
	quietZoneSizeMod: 0,
})
fs.writeFileSync("output.jpg", jpeg.encode(inputImg, 100).data)
```

## API

### General behavior

`qrextract` functions work as `Array.prototype.every()`:
- they call `callback` once for every thing it is required to look for
- they stop as soon as one of `callback` calls returns `false`
- they return `true` if all `callback` calls return `true`, `false` otherwise.

The same image format as `jpeg-js` module is used.

The behavior of these functions can be customized by passing a `customOptions` object as the last parameter, with the following properties (default values are used for missing properties):
- `angleCompatMarginPct`: error margin in % when checking that the 3 marks of a QR code form a 90° angle (default value: `0.1` for 10%)
- `blackWhiteMinDiff`: minimum color value difference between black and white modules ("dots") of a QR code (default value: `100`)
- `codeVersionMin` and `codeVersionMax`: minimum and maximum QR code versions to look for (default values: `1` and `40`, ie all possible versions)
- `moduleCompatMarginPct`: error margin in % for the module size of 2 marks to be compatible enough to belong to the same QR code (default value: `0.2` for 20%)
- `moduleSizePxMin`: minimum QR code module size to look for (default value: `4`)
- `moduleXYCompatMarginPct`: error margin in % for the X and Y module size of a possible mark to be compatible enough for it to be considered as a QR code mark (default value: `0.1` for 10%)
- `quietZoneSizeMod`: size in module of the quiet zone around a QR code when calculating its bounding box (default value: `4`)
- `windowSizePx`: size of the small pixel window used when looking for marks on the X axis (default value: `100`). This window is used to determine the threshold between white and black modules in a QR code, as this threshold can vary in the image
- `zoneLengthMarginPx`: error margin in pixels for the black and white zones of a possible mark to be considered as having coherent enough lengths for them to belong to a QR code mark (default value: `2`)
- `skipRowsPx`: to speed the process up, as a single QR code mark is usualy several rows high, only 1 over `skipRowsPx` rows is scanned for marks (default value: `moduleSizePxMin`)

### qrextract.everyCodeImage(image, callback, customOptions = {})

Call `callback` for every QR code found in `image`, with the QR code image and its index.

### qrextract.everyMarkImage(image, callback, customOptions = {})

Call `callback` for every possible QR code marks found in `image`, with the mark image and its index.

This function corresponds to the step 1 of 4 of the algorithm used by `qrextract.everyCodeImage()` above.

Warning: not all of these possible marks are guaranteed to be QR code marks!

### qrextract.everyPairImage(image, callback, customOptions = {})

Call `callback` for every compatible pairs of QR code marks found in `image`, with the pair image and its index.

This function corresponds to the steps 1 and 2 of 4 of the algorithm used by `qrextract.everyCodeImage()` above.

Warning: not all of these pairs are guaranteed to be pairs of marks belonging to the same QR codes!

### qrextract.everyTripleImages(image, callback, customOptions = {})

Call `callback` for every compatible triples of QR code marks found in `image`, with the triple image and its index.

This function corresponds to the steps 1 to 3 of 4 of the algorithm used by `qrextract.everyCodeImage()` above.

Warning: all of these triples are guaranteed to be triples of marks belonging to the same QR codes!

### qrextract.every[...]BoudingBox(image, callback, customOptions = {})

Same thing as `qrextract.every[...]Image()` functions described above, but `callback` is called with a bounding box instead of an image.

The bounding box is an object with:
- 2 `min` and `max` properties, each one an object with `x` and `y` properties, describing the min and max coordinates of the box on the X and Y axis
- a `threshold` property with the threshold value used to distinguish white and black pixels
