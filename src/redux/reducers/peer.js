import * as types from '../actionTypes'

const initialState = {
  loading: true,
  list: []
}

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case types.LOAD_PEERS:
      return {
        ...state,
        loading: true
      }
    case types.LOAD_PEERS_SUCCESS:
      return {
        ...state,
        loading: false,
        list: action.result
      }
    case types.LOAD_PEERS_FAIL:
      return {
        ...state,
        loading: false
      }
    case types.ADD_PEER_SUCCESS:
      return {
        ...state,
        list: [action.result].concat(state.list)
      }
    case types.UPDATE_PEER_SUCCESS:
      return {
        ...state,
        list: state.list.map((peer) => {
          if (peer.id !== action.result.id) return peer

          return action.result
        })
      }
    case types.REMOVE_PEER_SUCCESS:
      return {
        ...state,
        list: state.list.filter(peer => peer.id !== action.result.id)
      }
    default:
      return state
  }
}