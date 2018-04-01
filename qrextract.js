/*
Copyright (c) 2016-2018, Mael Le Guen.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

function getOptions(customOptions) {
	// Constant options
	var defaultOptions = {
		// Error margin in % for the 90° angle formed by the 3 QR code marks
		angleCompatMarginPct: 0.1,
		// Minimum color value difference between black and white modules
		blackWhiteMinDiff: 100,
		// Maximum and minimum QR code version (all by default)
		codeVersionMax: 40,
		codeVersionMin: 1,
		// Error margin in % for the module size of 2 marks to be compatible
		moduleCompatMarginPct: 0.2,
		// Minimum module size
		moduleSizePxMin: 4,
		// Error margin in % for the X and Y module size of a mark to be compatible
		moduleXYCompatMarginPct: 0.1,
		// Size in modules of the quiet zone around a QR code
		quietZoneSizeMod: 4,
		// Size of the pixel window used when looking for marks on the X axis
		windowSizePx: 100,
		// Error margin in pixels for the black and white zones of a mark to be
		// considered as having coherent lengths
		zoneLengthMarginPx: 2,
	}

	// Replace default options with values specified in customOptions
	Object.assign(defaultOptions, customOptions)

	// Calculated options

	// The number of rows to skip after a row is scanned for mark to increase
	// the scanning speed, as a single mark can be found on several contiguous
	// rows. By default, calculated for a same mark to be scanned 3 times max
	defaultOptions.skipRowsPx = Math.round(defaultOptions.moduleSizePxMin)

	// Replace default options with values specified in customOptions a 2nd time
	// to replace calculated options if specified in customOptions
	return Object.assign(defaultOptions, customOptions)
}

// Look for a mark on the Y axis, using the same principle as described in
// checkMarkX below
function checkMarkY(image, x, ymin, ymax, threshold, options) {
	ymin = ymin < 0 ? 0 : ymin
	ymax = ymax >= image.height ? image.height-1 : ymax

	var rowPnt = (ymin*image.width+x)*4

	var lastIsBlack = (image.data[rowPnt] + image.data[rowPnt+1] + image.data[rowPnt+2])<threshold
	var zoneLength = 1, totZoneLength = 0, zoneLengths = []
	rowPnt+=image.width*4

	for (var y=ymin+1; y<=ymax; y++) {
		var isBlack = (image.data[rowPnt] + image.data[rowPnt+1] + image.data[rowPnt+2])<threshold
		if (isBlack == lastIsBlack) {
			zoneLength++
		}
		else {
			zoneLengths.push(zoneLength)
			totZoneLength += zoneLength

			if (zoneLengths.length == 5) {
				var markY = {modSize: totZoneLength/7}
				if (markY.modSize >= options.moduleSizePxMin) {
					var minModSize = Math.ceil(markY.modSize)-options.zoneLengthMarginPx
					var maxModSize = Math.ceil(markY.modSize)+options.zoneLengthMarginPx
					if (
						((zoneLengths[0] >= minModSize) && (zoneLengths[0] <= maxModSize)) &&
						((zoneLengths[1] >= minModSize) && (zoneLengths[1] <= maxModSize)) &&
						((zoneLengths[2] >= 3*minModSize) && (zoneLengths[2] <= 3*maxModSize)) &&
						((zoneLengths[3] >= minModSize) && (zoneLengths[3] <= maxModSize)) &&
						((zoneLengths[4] >= minModSize) && (zoneLengths[4] <= maxModSize))
					) {
						markY.center = y-totZoneLength/2
						markY.min = Math.floor(markY.center-markY.modSize*1.5)
						markY.max = Math.ceil(markY.center+markY.modSize*1.5)
						return markY
					}
					totZoneLength -= zoneLengths.shift()
				}
			}

			lastIsBlack = isBlack
			zoneLength = 1
		}

		rowPnt+=image.width*4
	}
}

function findMarkX(image, options) {
	var marks = []

	var rowPnt = 0
	while (rowPnt < image.data.length) {

		// Init the window by filling it with the end of the row
		var pxWindow = []
		var colPnt = rowPnt+image.width*4
		for (var winIdx=0; winIdx<options.windowSizePx-1; winIdx++) {
			colPnt-=4
			pxWindow.push(image.data[colPnt] + image.data[colPnt+1] + image.data[colPnt+2])
		}

		do {
			colPnt-=4
			pxWindow.push(image.data[colPnt] + image.data[colPnt+1] + image.data[colPnt+2])

			// Find the darkest and the lightest colors in the window
			darkest = Math.min(...pxWindow)
			lightest = Math.max(...pxWindow)

			// If they are different enough to consider them as "black" and the "white"
			if (lightest >= darkest + options.blackWhiteMinDiff) {

				// Define the threshold to distinguish black and white pixels (this
				// threshold is recalculated each time the window moves, as lighting
			  // can change in the image)
				var threshold = (darkest+lightest)/2

				// Iterate over the window pixels looking for color changes (black to
				// white or white to black) and measure the length of zones of
				// adjacent pixels of the same color
				var lastIsBlack = pxWindow[0] < threshold
				var zoneLength = 1, totZoneLength = 0, zoneLengths = []
				for (var winIdx=1; winIdx<options.windowSizePx; winIdx++) {
					var isBlack = pxWindow[winIdx]<threshold
					// As long as the color does not change, increase the current zone length
					if (isBlack == lastIsBlack) {
						zoneLength++
					}
					// When the color does change, store the current zone length
					else {
						zoneLengths.push(zoneLength)
						totZoneLength += zoneLength

						// When we have enough zones to form a QR code mark (ie 5 zones:
						// black, white, black, white and black)...
						if (zoneLengths.length == 5) {
							// Calculate the module size (ie the size of a "pixel" of the QR
							// code) and check if is big enough
							var markX = {modSize: totZoneLength/7}
							if (markX.modSize >= options.moduleSizePxMin) {
								// Check the lengths of the 5 zones are coherent with a QR code
								// mark (ie 1, 1, 3, 1 and 1 modules long)
								var minModSize = Math.ceil(markX.modSize)-options.zoneLengthMarginPx
								var maxModSize = Math.ceil(markX.modSize)+options.zoneLengthMarginPx
								if (
									((zoneLengths[0] >= minModSize) && (zoneLengths[0] <= maxModSize)) &&
									((zoneLengths[1] >= minModSize) && (zoneLengths[1] <= maxModSize)) &&
									((zoneLengths[2] >= 3*minModSize) && (zoneLengths[2] <= 3*maxModSize)) &&
									((zoneLengths[3] >= minModSize) && (zoneLengths[3] <= maxModSize)) &&
									((zoneLengths[4] >= minModSize) && (zoneLengths[4] <= maxModSize))
								) {
									// At this point we have a potential mark on the X axis, whose
									// center is the center of the five zones
									markX.center = (colPnt-rowPnt)/4+(options.windowSizePx-winIdx)+totZoneLength/2
									markX.min = Math.floor(markX.center-markX.modSize*1.5)
									markX.max = Math.ceil(markX.center+markX.modSize*1.5)

									currentY = rowPnt/(image.width*4)

									// Check this potential mark is not an already found one
									if (!marks.some(function(m) {
										return (markX.min <= m.x.max) && (markX.max >= m.x.min) &&
										(currentY <= m.y.max) && (currentY >= m.y.min)
									})) {
										// Look for the same mark on the Y axis
										var markY = checkMarkY(
											image,
											Math.round(markX.center),
											Math.floor(currentY-6*markX.modSize),
											Math.ceil(currentY+6*markX.modSize),
											threshold,
											options
										)
										if (markY) {
											// If there are not too many differences between module
											// sizes found on X and Y axis
											if ((markY.modSize >= markX.modSize*(1-options.moduleXYCompatMarginPct)) &&
											(markY.modSize <= markX.modSize*((1+options.moduleXYCompatMarginPct)))) {
												// Store the new found mark
												m = {
													x: markX,
													y: markY,
													threshold: threshold,
													id: marks.length,
												}
												// console.log("Mark found: #%d, [%d, %d]", m.id, m.x.center, m.y.center)
												marks.push(m)
											}
										}
										// 	else {
										// 		console.log("Potential mark at [%d, %d] rejected: nothing found on Y axis", markX.center, currentY)
										// 	}
									}
									// else {
									// 	console.log("Potential mark at [%d, %d] rejected: same zone as an already found mark", markX.center, currentY)
									// }
								}
								// Remove the oldest zone
								totZoneLength -= zoneLengths.shift()
							}
						}
						// As the color changed, start a new zone and go on iterating over
						// the window pixels
						lastIsBlack = isBlack
						zoneLength = 1
					}
				}
			}
			// Move the window left and start again looking for marks
			pxWindow.shift()
		} while (colPnt>rowPnt)
		// Start a new row, skipping options.skipRowsPx row
		rowPnt+=image.width*4*options.skipRowsPx
	}
	return marks
}

function groupMarksByPairs(marks, options) {
	pairs = []
	marks.forEach(function(m1, index1) {
		m1.tripleCount = 0

		marks.forEach(function(m2, index2) {
			// Remove duplicates
			if (index2 <= index1) {
				return
			}

			// Are the 2 marks module size compatible ? No => not a pair
			xModSize = (m1.x.modSize + m2.x.modSize) / 2.0
			yModSize = (m1.y.modSize + m2.y.modSize) / 2.0
			if ([m1, m2].some(
				m =>
					(m.x.modSize < xModSize * (1-options.moduleCompatMarginPct)) ||
					(m.x.modSize > xModSize * (1+options.moduleCompatMarginPct)) ||
					(m.y.modSize < yModSize * (1-options.moduleCompatMarginPct)) ||
					(m.y.modSize > yModSize * (1+options.moduleCompatMarginPct))
			)) {
				// console.log("Pair rejected: [%d, %d], bad module size", m1.id, m2.id)
				return
			}

			// Calculate first the real module size on M1M2 axis
			// It can be different from module sizes read on X and Y axis
			// when the QR code is not aligned on these axis (ie is rotated)

			xDist = m2.x.center-m1.x.center
			yDist = m2.y.center-m1.y.center

			// alpha is the angle between the X axis and M1M2
			alpha = (xDist == 0) ? Math.PI/2.0 : Math.atan(yDist/xDist)
			realModSize = Math.max(
				Math.abs(xModSize * Math.cos(alpha)),
				Math.abs(yModSize * Math.sin(alpha))
			)

			// The size of the QR code is the number of modules between the 2 marks
			// + the size of a mark (7)
			dist = Math.sqrt(xDist*xDist + yDist*yDist)
			codeSize = Math.round(dist / realModSize) + 7

			// The size of a QR code grows 4 modules by 4 modules, from version 1
			// (21x21 => 21 = 17 + 1*4) to version 40 (177x177 => 177 = 17 + 40*4)
			version = Math.round((codeSize - 17) / 4)

			// Not an authorized version => not a pair
			if ((version < options.codeVersionMin) || (version > options.codeVersionMax)) {
				// console.log("Pair rejected: [%d, %d], unauthorized version %d, xModSize=%d, yModSize=%d, realModSize=%d", m1.id, m2.id, version, xModSize, yModSize, realModSize)
				return
			}

			// Store the new pair
			p = {
				marks: [m1, m2],
				angle: alpha,
				version: version,
			}
			pairs.push(p)
			// console.log("Pair found: [%d, %d], %d rad, version %d", m1.id, m2.id, p.angle, p.version)
		})
	})
	return pairs
}

function updateTripleAlternativeCount(triples) {
	triples.forEach(function(t) {
		// Calculate the number of alternatives for the 3 marks
		// if this triple is not chosen
		t.alternativeCount = Math.min(...t.marks.map(m => m.tripleCount)) - 1
	})
}

function groupPairsByTriples(pairs, options) {
	triples = []
	pairs.forEach(function(p1, index1) {
		pairs.forEach(function(p2, index2) {
			// Remove duplicates
			if (index2 <= index1) {
				return
			}
			// The 2 pairs must have a common mark
			if (p1.marks[0] != p2.marks[0]) {
				if (p1.marks[1] != p2.marks[0]) {
					if (p1.marks[1] != p2.marks[1]) {
						return
					}
					others = [p1.marks[0], p2.marks[0]]
				}
				else {
					others = [p1.marks[0], p2.marks[1]]
				}
				common = p1.marks[1]
			}
			else {
				common = p1.marks[0]
				others = [p1.marks[1], p2.marks[1]]
			}
			if (
				(p1.marks[0] != p2.marks[0]) &&
				(p1.marks[1] != p2.marks[0]) &&
				(p1.marks[1] != p2.marks[1])
			) {
				return
			}
			// They must have the same version
			if (p1.version != p2.version) {
				return
			}
			// They must form a 90° angle (top and left sides of the QR code)
			angle = Math.abs(p2.angle-p1.angle)
			if (
				(angle < Math.PI/2.0*(1-options.angleCompatMarginPct)) ||
				(angle > Math.PI/2.0*(1+options.angleCompatMarginPct))
			) {
				return
			}
			// Store the new triple
			t = {
				marks: [common, others[0], others[1]],
				version: p1.version,
			}
			triples.push(t)
			// Update each mark' triple count (how many triples it could belong to)
			t.marks.forEach(function(m) {
				m.tripleCount++
			})
		})
	})
	updateTripleAlternativeCount(triples)
	return triples
}

function sortTriples(triples) {
	triples = triples.sort(function(t1, t2) {
		// Sort first by ascending version
		if (t1.version != t2.version) {
			return t1.version-t2.version
		}
		// Then by ascending alternative count
		return t1.alternativeCount-t2.alternativeCount
	})
	// console.log("Triples sorted:")
	// triples.forEach(function(t, index) {
	// 	console.log("Triple #%d: [%d, %d, %d], version %d, %d alternative(s)", index, ...t.marks.map(m => m.id), t.version, t.alternativeCount)
	// })
	return triples
}

function removeTriples(t0, triples) {
	// Keep only triples...
	triples = triples.filter(function(t) {
		// ... which do not have a mark...
		keep = !t.marks.some(function(m) {
			// ... in common with t0
			return t0.marks.some(m0 => m == m0)
		})
		// Update marks triple count if not kept
		if (!keep) {
			t.marks.forEach(function(m) {
				m.tripleCount--
			})
		}
		return keep
	})
	updateTripleAlternativeCount(triples)
	return triples
}

function chooseCodeTriples(triples) {
	var chosen = []

	while (triples.length > 0) {
		triples = sortTriples(triples)
		t = triples[0]
		chosen.push(t)
		// console.log("Triple chosen: [%d, %d, %d], version %d", ...t.marks.map(m => m.id), t.version)
		triples = removeTriples(t, triples)
	}

	return chosen
}

function getBoundingBox(marks, imageWidth, imageHeight, options) {
	return {
		min :{
			x: Math.max(0, Math.floor(Math.min(...marks.map(m => m.x.center - (3.5+options.quietZoneSizeMod)*m.x.modSize)))),
			y: Math.max(0, Math.floor(Math.min(...marks.map(m => m.y.center - (3.5+options.quietZoneSizeMod)*m.y.modSize)))),
		},
		max :{
			x: Math.min(Math.ceil(Math.max(...marks.map(m => m.x.center + (3.5+options.quietZoneSizeMod)*m.x.modSize))), imageWidth),
			y: Math.min(Math.ceil(Math.max(...marks.map(m => m.y.center + (3.5+options.quietZoneSizeMod)*m.y.modSize))), imageHeight),
		},
		threshold: marks.reduce((acc, m) => acc += m.threshold, 0) / marks.length
	}
}

function getBoxImage(box, image) {
	var boxImage = {
		width: box.max.x-box.min.x+1,
		height: box.max.y-box.min.y+1
	}
	boxImage.data = new Buffer(boxImage.width*boxImage.height*4)

	var offset2 = 0
	for (var y=0; y<boxImage.height; y++) {
		var offset = ((box.min.y+y)*image.width+box.min.x)*4
		for (var x=0; x<boxImage.width; x++) {
			boxImage.data[offset2] = (image.data[offset]+image.data[offset+1]+image.data[offset+2])<box.threshold ? 0 : 255
			boxImage.data[offset2+1] = boxImage.data[offset2]
			boxImage.data[offset2+2] = boxImage.data[offset2]
			boxImage.data[offset2+3] = 255

			offset += 4
			offset2 += 4
		}
	}

	return boxImage
}

exports.everyMarkBoundingBox = function(image, callback, customOptions = {}) {
	var options = getOptions(customOptions)

	var marks = findMarkX(image, options)
	// console.log("%d marks found", marks.length)

	return marks.every(function(m, index) {
		var box = getBoundingBox([m], image.width, image.height, options)
		// console.log("Mark %d: [%d, %d]- [%d, %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)
		return callback(box, index)
	})
}

exports.everyMarkImage = function(image, callback, customOptions = {}) {
	return exports.everyMarkBoundingBox(image, function(box, index) {
		var markImage = getBoxImage(box, image)
		return callback(markImage, index)
	}, customOptions)
}

exports.everyPairBoundingBox = function(image, callback, customOptions = {}) {
	var options = getOptions(customOptions)

	var marks = findMarkX(image, options)
	// console.log("%d marks found", marks.length)
	var pairs = groupMarksByPairs(marks, options)
	// console.log("%d pairs found", pairs.length)

	return pairs.every(function(p, index) {
		var box = getBoundingBox(p.marks, image.width, image.height, options)
		// console.log("Pair %d: [%d, %d]- [%d, %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)
		return callback(box, index)
	})
}

exports.everyPairImage = function(image, callback, customOptions = {}) {
	return exports.everyPairBoundingBox(image, function(box, index) {
		var pairImage = getBoxImage(box, image)
		return callback(pairImage, index)
	}, customOptions)
}

function getCodeBoundingBox(t, imageWidth, imageHeight, options) {
	// Let's calculate the center of a virtual bottom right mark
	m4 = {
		x: {
			center: t.marks[1].x.center +	(t.marks[2].x.center - t.marks[0].x.center),
			modSize: t.marks.reduce((acc, m) => acc += m.x.modSize, 0) / t.marks.length,
		},
		y: {
			center: t.marks[1].y.center +	(t.marks[2].y.center - t.marks[0].y.center),
			modSize: t.marks.reduce((acc, m) => acc += m.y.modSize, 0) / t.marks.length,
		},
		threshold: t.marks.reduce((acc, m) => acc += m.threshold, 0) / t.marks.length,
	}

	return getBoundingBox([...t.marks, m4], imageWidth, imageHeight, options)
}

exports.everyTripleBoundingBox = function(image, callback, customOptions = {}) {
	var options = getOptions(customOptions)

	var marks = findMarkX(image, options)
	// console.log("%d marks found", marks.length)
	var pairs = groupMarksByPairs(marks, options)
	// console.log("%d pairs found", pairs.length)
	var triples = groupPairsByTriples(pairs, options)
	// console.log("%d triples found", triples.length)

	return triples.every(function(t, index) {
		var box = getCodeBoundingBox(t, image.width, image.height, options)
		// console.log("Triple %d: [%d, %d]- [%d, %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)
		return callback(box, index)
	})
}

exports.everyTripleImage = function(image, callback, customOptions = {}) {
	return exports.everyTripleBoundingBox(image, function(box, index) {
		var tripleImage = getBoxImage(box, image)
		return callback(tripleImage, index)
	}, customOptions)
}

exports.everyCodeBoundingBox = function(image, callback, customOptions = {}) {
	var options = getOptions(customOptions)

	var marks = findMarkX(image, options)
	// console.log("%d marks found", marks.length)
	var pairs = groupMarksByPairs(marks, options)
	// console.log("%d pairs found", pairs.length)
	var triples = groupPairsByTriples(pairs, options)
	// console.log("%d triples found", triples.length)
	triples = chooseCodeTriples(triples)
	// console.log("%d QR codes found", triples.length)

	return triples.every(function(t, index) {
		var box = getCodeBoundingBox(t, image.width, image.height, options)
		// console.log("Triple %d: [%d, %d]- [%d, %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)
		return callback(box, index)
	})
}

exports.everyCodeImage = function(image, callback, customOptions = {}) {
	return exports.everyCodeBoundingBox(image, function(box, index) {
		var codeImage = getBoxImage(box, image)
		return callback(codeImage, index)
	}, customOptions)
}
