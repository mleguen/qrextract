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
	
			var minLvl = 256*3-1, maxLvl = 0;
			pxWindow.forEach(function(lvl) {
				if (lvl < minLvl) {minLvl = lvl;}
				if (lvl > maxLvl) {maxLvl = lvl;}	
			});
			
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

									var center = (colPnt-rowPnt)/4+(winSizePx-winIdx)+totZoneLength/2;
								
									if (markY) {
										if ((markY.modSize >= markX.modSize*0.8) &&
											(markY.modSize <= markX.modSize*1.2)) {									
											marks.push({x: markX, y: markY, threshold: threshold});
										}
									}
	
								}
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

function groupMarks(marks, QRCodeSizeMod) {
	var boundingBoxes = [];
	
	// Look for all combinations of markers
	marks.forEach(function(m1, index1) {
		marks.forEach(function(m2, index2) {
			// Force combination to be sorted to remove doubles
			if (index2 > index1) {
				marks.forEach(function(m3, index3) {
					// Again
					if (index3 > index2) {
						
						// Module size average of the 3 markers
						var xModSizeMoy = (m1.x.modSize + m2.x.modSize + m3.x.modSize)/3,
							yModSizeMoy = (m1.y.modSize + m2.y.modSize + m3.y.modSize)/3;

						// Only keep combinations whose module sizes are not within 20% of the average
						if (![m1, m2, m3].some(function(m) {
							return (m.x.modSize < xModSizeMoy*0.95) || (m.x.modSize > xModSizeMoy*1.05) ||
								(m.y.modSize < yModSizeMoy*0.95) || (m.y.modSize > yModSizeMoy*1.05);
						})) {
							var sortedPairs = [[m1, m2, m3], [m2, m3, m1], [m3, m1, m2]].map(function(pair) {
								return {
									sqDist: Math.pow((pair[1].x.center-pair[0].x.center)/xModSizeMoy, 2) +
										Math.pow((pair[1].y.center-pair[0].y.center)/yModSizeMoy, 2),
									marks: pair
								};
							}).sort(function(da, db) {
								return da.sqDist - db.sqDist;
							});
							
							// Only keep rectangle isoscele triangles
							var sqSideSum = sortedPairs[0].sqDist + sortedPairs[1].sqDist;
							var sqSideMoy = sqSideSum/2;
							var sqDiag = sortedPairs[2].sqDist;
							
							if (
								(sqDiag >= sqSideSum*0.8) && (sqDiag <= sqSideSum*1.20) && // square diagonal should be the sum of square sides
								![sortedPairs[0].sqDist, sortedPairs[1].sqDist].some(function(sqd) {
									return (sqd < sqSideMoy*0.8) || (sqd > sqSideMoy*1.20); // and both sides should be the same length
								})
							) {
								// Calculate the fourth angle of the code
								var m4 = {
									x: sortedPairs[2].marks[0].x.center + (sortedPairs[2].marks[1].x.center - sortedPairs[2].marks[2].x.center),
									y: sortedPairs[2].marks[0].y.center + (sortedPairs[2].marks[1].y.center - sortedPairs[2].marks[2].y.center)
								};

								// And the bouding box
								var xMin = m4.x, xMax = m4.x, yMin = m4.y, yMax = m4.y;
								sortedPairs[2].marks.forEach(function(m) {
									if (m.x.center < xMin) {xMin = m.x.center;}
									if (m.x.center > xMax) {xMax = m.x.center;}
									if (m.y.center < yMin) {yMin = m.y.center;}
									if (m.y.center > yMax) {yMax = m.y.center;}
								});
								
								// TODO : calculate code orientation
								
								boundingBoxes.push({
									min: {x: Math.floor(xMin - 7*xModSizeMoy), y: Math.floor(yMin - 7*yModSizeMoy)},
									max: {x: Math.ceil(xMax + 7*xModSizeMoy), y: Math.ceil(yMax + 7*yModSizeMoy)},
									threshold: (m1.threshold + m2.threshold + m3.threshold)/3
								});
							}
						}
					}
				});
			}
		});
	});
	
	return boundingBoxes;
}

exports.extract = function (image) {
	var codeImages = [];

	var marksFound = findMarkX(image, 100, 20);

	if (marksFound &&
		(marksFound.length < 100)
	) {
		var QRCodeSizeMod = 21;
		var boxes = groupMarks(marksFound);
		
		boxes.forEach(function(box, index) {
			var codeImage = {
					width: box.max.x-box.min.x+1,
					height: box.max.y-box.min.y+1
				};
			codeImage.data = new Buffer(codeImage.width*codeImage.height*4);
			
			var offset2 = 0;
			for (var y=0; y<codeImage.height; y++) {
				var offset = ((box.min.y+y)*image.width+box.min.x)*4;
				for (var x=0; x<codeImage.width; x++) {
					codeImage.data[offset2] = (image.data[offset]+image.data[offset+1]+image.data[offset+2])<box.threshold ? 0 : 255;
					codeImage.data[offset2+1] = codeImage.data[offset2];
					codeImage.data[offset2+2] = codeImage.data[offset2];
					codeImage.data[offset2+3] = 255;
		
					offset += 4;
					offset2 += 4;
				}
			}

			codeImages.push(codeImage);			
		});
	}

	return codeImages;
}

