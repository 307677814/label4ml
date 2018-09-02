// (C) 2018 netqon.com all rights reserved.

const { remote } = require('electron')
const { Menu, MenuItem } = remote
const utils = require('./utils')

function create(element) {
    console.log("create ic menu on", element)
    element.oncontextmenu = () => {
        const menu = new Menu()
        menu.append(new MenuItem({ role: 'cut', label: utils.lg('剪切', 'Cut') }))
        menu.append(new MenuItem({ role: 'Copy', label: utils.lg('拷贝', 'Copy') }))
        menu.append(new MenuItem({ role: 'Paste', label: utils.lg('粘贴', 'Paste') }))
        menu.popup({ window: remote.getCurrentWindow() })
    }
}

function auto_create() {
    console.log('icmenu auto create')
    let nodes = document.all
    for (var i = 0; i < nodes.length; i++) {
        let o = nodes[i]
        // console.log(o.tagName, o.getAttribute('type'))
        if (o.tagName == 'INPUT' && o.hasAttribute('type') && o.getAttribute('type') == 'text') {
            create(o)
        }
        if (o.tagName == 'TEXTAREA') {
            create(o)
        }
    }
}

exports.create = create
exports.auto_create = auto_create