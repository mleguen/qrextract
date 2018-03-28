/*
Copyright (c) 2016, Mael Le Guen.

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

function checkMarkY(image, x, ymin, ymax, threshold) {
	ymin = ymin < 0 ? 0 : ymin;
	ymax = ymax >= image.height ? image.height-1 : ymax;

	var winSizePx = ymax-ymin;
	var rowPnt = (ymin*image.width+x)*4;

	var lastIsBlack = (image.data[rowPnt] + image.data[rowPnt+1] + image.data[rowPnt+2])<threshold;
	var zoneLength = 1, totZoneLength = 0, zoneLengths = [];
	rowPnt+=image.width*4;

	for (var y=ymin+1; y<=ymax; y++) {
		var isBlack = (image.data[rowPnt] + image.data[rowPnt+1] + image.data[rowPnt+2])<threshold;
		if (isBlack == lastIsBlack) {
			zoneLength++;
		}
		else {
			zoneLengths.push(zoneLength);
			totZoneLength += zoneLength;

				if ((zoneLengths.length == 5) && (totZoneLength >= 35)) {
				var markY = {modSize: totZoneLength/7};
				var minModSize = Math.floor(markY.modSize)-2, maxModSize = Math.ceil(markY.modSize+2);
				if (
					((zoneLengths[0] >= minModSize) && (zoneLengths[0] <= maxModSize)) &&
					((zoneLengths[1] >= minModSize) && (zoneLengths[1] <= maxModSize)) &&
					((zoneLengths[2] >= 3*minModSize) && (zoneLengths[2] <= 3*maxModSize)) &&
					((zoneLengths[3] >= minModSize) && (zoneLengths[3] <= maxModSize)) &&
					((zoneLengths[4] >= minModSize) && (zoneLengths[4] <= maxModSize))
				) {
					markY.center = y-totZoneLength/2;
					markY.min = Math.floor(markY.center-markY.modSize*5);
					markY.max = Math.ceil(markY.center+markY.modSize*5);
					return markY;
				}
				totZoneLength -= zoneLengths.shift();
			}

			lastIsBlack = isBlack;
			zoneLength = 1;
		}

		rowPnt+=image.width*4;
	}
}

function findMarkX(image, winSizePx, speed) {
	var marks = [];

	var rowPnt = 0;
	while (rowPnt < image.data.length) {
		var colPnt = rowPnt+image.width*4;

		var pxWindow = [];
		for (var winIdx=0; winIdx<winSizePx-1; winIdx++) {
			colPnt-=4;
			pxWindow.push(image.data[colPnt] + image.data[colPnt+1] + image.data[colPnt+2]);
		}

		do {
			colPnt-=4;
			pxWindow.push(image.data[colPnt] + image.data[colPnt+1] + image.data[colPnt+2]);

			minLvl = Math.min(...pxWindow)
			maxLvl = Math.max(...pxWindow)

			if (maxLvl >= minLvl+100) {
				var threshold = (minLvl+maxLvl)/2;
				var lastIsBlack = pxWindow[0] < threshold;
				var zoneLength = 1, totZoneLength = 0, zoneLengths = [];
				for (var winIdx=1; winIdx<winSizePx; winIdx++) {
					var isBlack = pxWindow[winIdx]<threshold;
					if (isBlack == lastIsBlack) {
						zoneLength++;
					}
					else {
						zoneLengths.push(zoneLength);
						totZoneLength += zoneLength;

						if ((zoneLengths.length == 5) && (totZoneLength >= 35)) {
							var markX = {modSize: totZoneLength/7};
							var minModSize = Math.ceil(markX.modSize)-2, maxModSize = Math.ceil(markX.modSize)+2;
							if (
								((zoneLengths[0] >= minModSize) && (zoneLengths[0] <= maxModSize)) &&
								((zoneLengths[1] >= minModSize) && (zoneLengths[1] <= maxModSize)) &&
								((zoneLengths[2] >= 3*minModSize) && (zoneLengths[2] <= 3*maxModSize)) &&
								((zoneLengths[3] >= minModSize) && (zoneLengths[3] <= maxModSize)) &&
								((zoneLengths[4] >= minModSize) && (zoneLengths[4] <= maxModSize))
							) {
								markX.center = (colPnt-rowPnt)/4+(winSizePx-winIdx)+totZoneLength/2;
								markX.min = Math.floor(markX.center-markX.modSize*5);
								markX.max = Math.ceil(markX.center+markX.modSize*5);

								currentY = rowPnt/(image.width*4);

								if (!marks.some(function(m) {
									return (markX.min <= m.x.max) && (markX.max >= m.x.min) &&
										(currentY <= m.y.max) && (currentY >= m.y.min);
								})) {
									var markYMinGuess = Math.floor(currentY-6*markX.modSize),	markYMaxGuess = Math.ceil(currentY+6*markX.modSize);
									var markY = checkMarkY(image, Math.round(markX.center), markYMinGuess, markYMaxGuess, threshold);

									if (markY) {
										if ((markY.modSize >= markX.modSize*0.8) &&
											(markY.modSize <= markX.modSize*1.2)) {
											m = {
												x: markX,
												y: markY,
												threshold: threshold,
												id: marks.length,
											};
											console.log("Mark found: #%d, [%d, %d]", m.id, m.x.center, m.y.center)
											marks.push(m);
										}
									}
								// 	else {
								// 		console.log("Potential marker at [%d, %d] rejected: nothing found on Y axis", markX.center, currentY)
								// 	}
								}
								// else {
								// 	console.log("Potential marker at [%d, %d] rejected: same zone as an already found marker", markX.center, currentY)
								// }
							}
							totZoneLength -= zoneLengths.shift();
						}

						lastIsBlack = isBlack;
						zoneLength = 1;
					}
				}
			}

			pxWindow.shift();
		} while (colPnt>rowPnt);

		rowPnt+=image.width*4*speed;
	}

	return marks;
}

function groupMarksByPairs(marks, minVersion, maxVersion) {
	pairs = []
	marks.forEach(function(m1, index1) {
		m1.tripleCount = 0

		marks.forEach(function(m2, index2) {
			// Remove duplicates
			if (index2 <= index1) {
				return
			}

			// Are the markers module size compatible ? No => not a pair
			xModSize = (m1.x.modSize + m2.x.modSize) / 2.0
			yModSize = (m1.y.modSize + m2.y.modSize) / 2.0
			if ([m1, m2].some(
				m =>
					(m.x.modSize < xModSize * 0.95) || (m.x.modSize > xModSize * 1.05) ||
					(m.y.modSize < yModSize * 0.95) || (m.y.modSize > yModSize * 1.05)
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
			// + the size of a marker (7)
			dist = Math.sqrt(xDist*xDist + yDist*yDist)
			codeSize = Math.round(dist / realModSize) + 7

			// The size of a QR code grows 4 modules by 4 modules, from version 1
			// (21x21 => 21 = 17 + 1*4) to version 40 (177x177 => 177 = 17 + 40*4)
			version = Math.round((codeSize - 17) / 4)

			// Does codeSize correspond to a precise version ? No => not a pair
			if ((this.codeSize - 17) % 4 > 0) {
				// console.log("Pair rejected: [%d, %d], bad code size %d, xModSize=%d, yModSize=%d, realModSize=%d", m1.id, m2.id, codeSize, xModSize, yModSize, realModSize)
				return
			}

			// Not an authorized version => not a pair
			if ((version < minVersion) || (version > maxVersion)) {
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
			console.log("Pair found: [%d, %d], %d rad, version %d", m1.id, m2.id, p.angle, p.version)
		})
	})
	return pairs
}

function updateTripleAlternativeCount(triples) {
	triples.forEach(function(t) {
		// Calculate the number of alternatives for the 3 markers
		// if this triple is not chosen
		t.alternativeCount = Math.min(...t.marks.map(m => m.tripleCount)) - 1
	})
}

function groupPairsByTriples(pairs) {
	triples = []
	pairs.forEach(function(p1, index1) {
		pairs.forEach(function(p2, index2) {
			// Remove duplicates
			if (index2 <= index1) {
				return
			}
			// The 2 pairs must have a common marker
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
			if ((angle < Math.PI/2.0*0.95) || (angle > Math.PI/2.0*1.05)) {
				return
			}
			// Store the new triple
			t = {
				marks: [common, others[0], others[1]],
				version: p1.version,
			}
			triples.push(t)
			// Update the markers' triple count
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
		// Sort first by ascending alternative count
		if (t1.alternativeCount != t2.alternativeCount) {
			return t1.alternativeCount-t2.alternativeCount
		}
		// Then by ascending version
		return t1.version-t2.version
	})
	console.log("Triples sorted:")
	triples.forEach(function(t, index) {
		console.log("Triple #%d: [%d, %d, %d], version %d, %d alternative(s)", index, ...t.marks.map(m => m.id), t.version, t.alternativeCount)
	})
	return triples
}

function removeTriples(t0, triples) {
	// Keep only triples...
	triples = triples.filter(function(t) {
		// ... which do not have a marker...
		keep = !t.marks.some(function(m) {
			// ... in common with t0
			return t0.marks.some(m0 => m == m0)
		})
		// Update markers triple count if not kept
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

function chooseQRcodeTriples(triples) {
	var chosen = [];

	while (triples.length > 0) {
		triples = sortTriples(triples)
		t = triples[0]
		chosen.push(t)
		console.log("Triple chosen: [%d, %d, %d], version %d", ...t.marks.map(m => m.id), t.version)
		triples = removeTriples(t, triples)
	}

	return chosen
}

function getMarkBoundingBox(m, imageWidth, imageHeight) {
	return {
		min :{
			x: Math.max(0, Math.floor(m.x.center - 7*m.x.modSize)),
			y: Math.max(0, Math.floor(m.y.center - 7*m.y.modSize)),
		},
		max :{
			x: Math.min(Math.ceil(m.x.center + 7*m.x.modSize), imageWidth),
			y: Math.min(Math.ceil(m.y.center + 7*m.y.modSize), imageHeight),
		},
		threshold: m.threshold
	}
}

function getPairBoundingBox(p, imageWidth, imageHeight) {
	return {
		min :{
			x: Math.max(0, Math.floor(Math.min(...p.marks.map(m => m.x.center - 7*m.x.modSize)))),
			y: Math.max(0, Math.floor(Math.min(...p.marks.map(m => m.y.center - 7*m.y.modSize)))),
		},
		max :{
			x: Math.min(Math.ceil(Math.max(...p.marks.map(m => m.x.center + 7*m.x.modSize))), imageWidth),
			y: Math.min(Math.ceil(Math.max(...p.marks.map(m => m.y.center + 7*m.y.modSize))), imageHeight),
		},
		threshold: p.marks.reduce((acc, m) => acc += m.threshold, 0) / p.marks.length
	}
}

function getQRCodeBoundingBox(t, imageWidth, imageHeight) {
	// Let's calculate the center of the bottom right marker if it existed
	xCenters = t.marks.map(m => m.x.center)
	yCenters = t.marks.map(m => m.y.center)
	xCenters.push(xCenters[1] +	(xCenters[2] - xCenters[0]))
	yCenters.push(yCenters[1] +	(yCenters[2] - yCenters[0]))

	// We can now calculate the bounding box
	modSizeX = t.marks.reduce((acc, m) => acc += m.x.modSize, 0) / t.marks.length
	modSizeY = t.marks.reduce((acc, m) => acc += m.y.modSize, 0) / t.marks.length
	threshold = t.marks.reduce((acc, m) => acc += m.threshold, 0) / t.marks.length

	return {
		min :{
			x: Math.max(0, Math.floor(Math.min(...xCenters) - 7*modSizeX)),
			y: Math.max(0, Math.floor(Math.min(...yCenters) - 7*modSizeY)),
		},
		max :{
			x: Math.min(Math.ceil(Math.max(...xCenters) + 7*modSizeX), imageWidth),
			y: Math.min(Math.ceil(Math.max(...yCenters) + 7*modSizeY), imageHeight),
		},
		threshold: threshold
	}
}

function extractBoxImage(box, image) {
	var boxImage = {
		width: box.max.x-box.min.x+1,
		height: box.max.y-box.min.y+1
	};
	boxImage.data = new Buffer(boxImage.width*boxImage.height*4);

	var offset2 = 0;
	for (var y=0; y<boxImage.height; y++) {
		var offset = ((box.min.y+y)*image.width+box.min.x)*4;
		for (var x=0; x<boxImage.width; x++) {
			boxImage.data[offset2] = (image.data[offset]+image.data[offset+1]+image.data[offset+2])<box.threshold ? 0 : 255;
			boxImage.data[offset2+1] = boxImage.data[offset2];
			boxImage.data[offset2+2] = boxImage.data[offset2];
			boxImage.data[offset2+3] = 255;

			offset += 4;
			offset2 += 4;
		}
	}

	return boxImage
}

exports.extractMarks = function(image, minVersion = 1, maxVersion = 40) {
	var markImages = [];

	var marks = findMarkX(image, 100, 5);
	console.log("%d marks found", marks.length)

	marks.forEach(function(m, index) {
		var box = getMarkBoundingBox(m, image.width, image.height);
		console.log("Pair %d: [%d; %d]- [%d; %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)

		markImage = extractBoxImage(box, image)
		markImages.push(markImage);
	});

	return markImages;
}

exports.extractPairs = function(image, minVersion = 1, maxVersion = 40) {
	var pairImages = [];

	var marks = findMarkX(image, 100, 5);
	console.log("%d marks found", marks.length)
	var pairs = groupMarksByPairs(marks, minVersion, maxVersion)
	console.log("%d pairs found", pairs.length)

	pairs.forEach(function(p, index) {
		var box = getPairBoundingBox(p, image.width, image.height);
		console.log("Pair %d: [%d; %d]- [%d; %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)

		pairImage = extractBoxImage(box, image)
		pairImages.push(pairImage);
	});

	return pairImages;
}

exports.extractTriples = function(image, minVersion = 1, maxVersion = 40) {
	var tripleImages = [];

	var marks = findMarkX(image, 100, 5);
	console.log("%d marks found", marks.length)
	var pairs = groupMarksByPairs(marks, minVersion, maxVersion)
	console.log("%d pairs found", pairs.length)
	var triples = groupPairsByTriples(pairs)
	console.log("%d triples found", triples.length)

	triples.forEach(function(t, index) {
		var box = getQRCodeBoundingBox(t, image.width, image.height);
		console.log("Triple %d: [%d; %d]- [%d; %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)

		tripleImage = extractBoxImage(box, image)
		tripleImages.push(tripleImage);
	});

	return tripleImages;
}

exports.extractQRCodes = function(image, minVersion = 1, maxVersion = 40) {
	var codeImages = [];

	var marks = findMarkX(image, 100, 5);
	console.log("%d marks found", marks.length)
	var pairs = groupMarksByPairs(marks, minVersion, maxVersion)
	console.log("%d pairs found", pairs.length)
	var triples = groupPairsByTriples(pairs)
	console.log("%d triples found", triples.length)
	triples = chooseQRcodeTriples(triples);
	console.log("%d QR codes found", triples.length)

	triples.forEach(function(t, index) {
		var box = getQRCodeBoundingBox(t, image.width, image.height);
		console.log("Image %d: [%d; %d]- [%d; %d]", index, box.min.x, box.min.y, box.max.x, box.max.y)

		codeImage = extractBoxImage(box, image)
		codeImages.push(codeImage);
	});

	return codeImages;
}

exports.extract = exports.extractQRCodes
