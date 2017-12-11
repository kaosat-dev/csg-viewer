const vec3 = require('gl-vec3')

/**
 * convert a CSG from csg.js to an array of geometries with positions, normals, colors & indices
 * typically used for example to display the csg data in a webgl wiever
 * @param {Array} csgs single or an array of CSG object
 * @param {Object} options options hash
 * @param {Boolean} options.smoothLighting=false set to true if we want to use interpolated vertex normals
 * this creates nice round spheres but does not represent the shape of the actual model
 * @param {Float} options.normalThreshold=0.349066 threshold beyond which to split normals // 20 deg
 * @param {String} options.faceColor='#FF000' hex color
 * @returns {Object} {indices, positions, normals, colors}
 */
function csgToGeometries (csgs, options) {
  const defaults = {
    smoothLighting: false, // set to true if we want to use interpolated vertex normals this creates nice round spheres but does not represent the shape of the actual model
    normalThreshold: 0.349066, // 20 deg
    faceColor: '#ff6600'// default color
  }
  const {smoothLighting, normalThreshold, faceColor} = Object.assign({}, defaults, options)
  const faceColorRgb = hexToRgbNormalized(faceColor) // TODO : detect if hex or rgba

  csgs = toArray(csgs)
  const geometriesPerCsg = csgs.map(convert)

  function convert (csg) {
    let geometries = []

    let positions = []
    let colors = []
    let normals = []
    let indices = []

    const polygons = csg.canonicalized().toPolygons()

    /* let positions = new Float32Array(faces * 3 * 3)
    let normals = new Float32Array(faces * 3 * 3) */

    let normalPositionLookup = []
    normalPositionLookup = {}
    let tupplesIndex = 0

    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i]

      const color = polygonColor(polygon, faceColorRgb)
      const rawNormal = polygon.plane.normal
      const normal = [rawNormal.x, rawNormal.y, rawNormal.z]

      const polygonIndices = []
      // we need unique tupples of normal + position , that gives us a specific index (indices)
      // if the angle between a given normal and another normal is less than X they are considered the same
      for (let j = 0; j < polygon.vertices.length; j++) {
        let index

        const vertex = polygon.vertices[j]
        const position = [vertex.pos.x, vertex.pos.y, vertex.pos.z]

        if (smoothLighting) {
          const candidateTupple = {normal, position}
          const existingTupple = fuzyNormalAndPositionLookup(normalPositionLookup, candidateTupple, normalThreshold)
          if (!existingTupple) {
            const existingPositing = normalPositionLookup[candidateTupple.position]
            const itemToAdd = [{normal: candidateTupple.normal, index: tupplesIndex}]
            if (!existingPositing) {
              normalPositionLookup[candidateTupple.position] = itemToAdd
            } else {
              normalPositionLookup[candidateTupple.position] = normalPositionLookup[candidateTupple.position]
                .concat(itemToAdd)
            }
            index = tupplesIndex
            // normalPositionLookup.push(candidateTupple)
            // index = normalPositionLookup.length - 1
            colors.push(color)
            normals.push(normal)
            positions.push(position)
            tupplesIndex += 1
          } else {
            index = existingTupple.index
          }
        } else {
          colors.push(color)
          normals.push(normal)
          positions.push(position)
          index = positions.length - 1
        }

        // let prevcolor = colors[index]
        polygonIndices.push(index)
      }

      for (let j = 2; j < polygonIndices.length; j++) {
        indices.push([polygonIndices[0], polygonIndices[j - 1], polygonIndices[j]])
      }

      // if too many vertices or we are at the end, start a new geometry
      if (positions.length > 65000 || i === polygons.length - 1) {
        geometries.push({
          indices,
          positions,
          normals,
          colors
        })
      }
    }
    return geometries
  }

  return geometriesPerCsg
}

/**
 * converts input data to array if it is not already an array
 * @param {Any} input data: can be null or undefined, an array , an object etc
 * @returns {Array} if inital data was an array it returns it unmodified,
 * otherwise a 0 or one element array
 */
function toArray (data) {
  if (data === undefined || data === null) { return [] }
  if (data.constructor !== Array) { return [data] }
  return data
}

/**
 * convert color from rgba object to the array of bytes
 * @param {Object} color `{r: r, g: g, b: b, a: a}`
 * @returns {Array}  `[r, g, b, a]`
 */
function colorBytes (colorRGBA) {
  let result = [colorRGBA.r, colorRGBA.g, colorRGBA.b]
  if (colorRGBA.a !== undefined) result.push(colorRGBA.a)
  return result
}

// modified from https://stackoverflow.com/questions/21646738/convert-hex-to-rgba
function hexToRgbNormalized (hex, alpha) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.length === 3 ? hex.slice(0, 1).repeat(2) : hex.slice(0, 2), 16)
  const g = parseInt(hex.length === 3 ? hex.slice(1, 2).repeat(2) : hex.slice(2, 4), 16)
  const b = parseInt(hex.length === 3 ? hex.slice(2, 3).repeat(2) : hex.slice(4, 6), 16)
  return (alpha ? [r, g, b, alpha] : [r, g, b]).map(x => x / 255)
}

/**
 * return the color information of a polygon
 * @param {Object} polygon a csg.js polygon
 * @param {Object} faceColor a hex color value to default to
 * @returns {Array}  `[r, g, b, a]`
 */
function polygonColor (polygon, faceColor) {
  let color = faceColor// colorBytes(faceColor)

  if (polygon.shared && polygon.shared.color) {
    color = polygon.shared.color
  } else if (polygon.color) {
    color = polygon.color
  }
  // opaque is default
  if (color.length < 4) {
    color.push(1.0)
  }
  return color
}

/**
 * determine if the two given normals are 'similar' ie if the distance/angle between the
 * two is less than the given threshold
 * @param {Array} normal a 3 component array normal
 * @param {Array} otherNormal another 3 component array normal
 * @returns {Boolean} true if the two normals are similar
 */
function areNormalsSimilar (normal, otherNormal, threshold) {
  return vec3.distance(normal, otherNormal) <= threshold
  // angle computation is too slow but actually precise
  // return vec3.angle(normal, otherNormal) <= threshold
}

function fuzyNormalAndPositionLookup (normalPositionLookup, toCompare, normalThreshold = 0.349066) {
  const normalsCandidates = normalPositionLookup[toCompare.position]
  if (normalsCandidates) {
    // normalPositionLookup[toCompare.position] = normalPositionLookup[toCompare.position].concat([toCompare.normal])
    // get array of normals with same position
    for (let i = 0; i < normalsCandidates.length; i++) {
      const normal = normalsCandidates[i].normal
      const similarNormal = areNormalsSimilar(normal, toCompare.normal, normalThreshold)
      const similar = similarNormal
      if (similar) {
        return {tupple: {position: toCompare.position, normal}, index:normalsCandidates[i].index}
      }
    }
  }
  return undefined
  /*
  for (let i = 0; i < normalPositionLookup.length; i++) {
    const tupple = normalPositionLookup[i]
    const similarNormal = areNormalsSimilar(tupple.normal, toCompare.normal, normalThreshold)
    const similarPosition = (
      tupple.position[0] === toCompare.position[0] &&
      tupple.position[1] === toCompare.position[1] &&
      tupple.position[2] === toCompare.position[2]
    )
    const similar = similarNormal && similarPosition
    if (similar) {
      return {tupple, index: i}
    }
  }
  return undefined */
}

module.exports = csgToGeometries
