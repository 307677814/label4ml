
const Store = require('electron-store');
const store = new Store();

//common data interface


exports.get_targets = ()=>{
    return store.get('targets', [])
}

exports.set_targets = (targets)=>{
    return store.set('targets', targets)
}

exports.add_target = (target)=>{
    let tmp = exports.get_targets()
    tmp.push(target)
    exports.set_targets(tmp)
}

exports.remove_target = (target)=>{
    let tmp = exports.get_targets()
    tmp = tmp.filter((v)=>{return v!=target})
    exports.set_targets(tmp)
}