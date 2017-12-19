const most = require('most')
const {update, rotate, zoom, pan, zoomToFit, reset} = require('./orbitControls')
const {setProjection} = require('./perspectiveCamera')

function copyAssign (original, newData) {
  // console.log('updated', newData.camera.view, original.camera.view)
  const camera = Object.assign({}, original.camera, newData.camera)
  const controls = Object.assign({}, original.controls, newData.controls)
  return Object.assign({}, original, {camera, controls})
}

function makeReducers (initialState) {
  const reducers = {
    undefined: (state) => state, // no op
    update: (state) => {
      return copyAssign(state, update(state))
    },
    resize: (state, sizes) => {
      return copyAssign(state, {camera: setProjection(state.camera, sizes)})
    },

    rotate: (state, angles) => {
      return copyAssign(state, rotate(state, angles))
    },

    zoom: (state, zooms) => {
      return copyAssign(state, zoom(state, zooms))
    },
    pan: (state, delta) => {
      return copyAssign(state, pan(state, delta))
    },
     /* zoomToFit: (state) => zoomToFit(state),
    reset: (state, params) => {
      console.log('initalsta', initialState.camera)
      let resetState = copyAssign(state, reset(state, initialState))
      // resetState = copyAssign(resetState, update(resetState))
      // resetState = nestedObjectAssign({}, resetState, update(resetState.controls, resetState.camera))
      // resetState = Object.assign({}, {camera, controls}, {camera: resetState.camera, controls: resetState.controls})
      // then apply zoomToFIt
      return resetState// zoomToFit(resetState.controls, resetState.camera)
    },*/
    setFromParams: (state, params) => {
      const {controls, camera} = state
      let result = {
        controls: {},
        camera: {}
      }
      if (params && 'controls' in params) {
        result.controls = params.controls
      }
      if (params && 'entity' in params) {
        result.controls.entity = params.entity
      }
      if (params && 'camera' in params) {
        result.camera = params.camera
      }

      return copyAssign(state, result)
    }
  }
  return reducers
}

module.exports = makeReducers
