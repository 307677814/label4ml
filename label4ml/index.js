// (C) 2018 netqon.com all rights reserved.

const electron = require('electron');
const path = require('path');
const locale = require('./locale');
const utils = require('./utils');
const moment = require('moment');
const { remote } = require('electron');
const { Menu, MenuItem } = remote;
const Store = require('electron-store');
const store = new Store();
const mystore = require('./mystore')
const uuidgen = require('uuid/v4');


window.onresize = function (e) {
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("init window");
    locale.init();

    reload_targets()

    $('#btn_add_target').click(on_click_new_target)
    $('#btn_add_module').click(on_click_new_module)

    $('#btn_add_new_target').click(on_click_new_target)
    $('#btn_remove_target_confirm').click(on_click_remove_target_confirm)
    $('#btn_delete_modules_confirm').click(on_click_delete_modules_confirm)

    $('#btn_open_settings').click(function () {
        electron.ipcRenderer.send('open-settings')
    })

    $('iframe').attr('src', "http://label4ml.netqon.com/embedded.html?t=" + new Date().getTime())

    $('.head-tab').click(on_click_head_tab)

    $('#btn_module_save').click(on_click_save_module)

    $('#input_module_name').keydown(on_module_name_change)

    $('#btn_module_play').click(on_click_play_module)
})


function reload_targets(){
    let targets = mystore.get_targets()
    console.log('targets', targets)

    $('#target_list').empty()
    g_target_map = {}

    targets.forEach(target=>{
        add_new_target_element(target)
    })
}


function on_click_head_tab(event) {

    let tab = $(event.target)
    if (tab.attr('pressed') == 'true') {
        tab.attr('pressed', 'false')
        $(`#editor_${tab.attr("tab-name")}`).hide()
    } else {
        tab.attr('pressed', 'true')
        $(`#editor_${tab.attr("tab-name")}`).show()
    }

    update_editor_layout()
}

/* targets */
let g_is_target_new = true
let g_under_config_target_element = null
let g_target_map = {} // id=>element -> element.web_target
function add_new_target_element(target) {
    let new_element = $('#target_template').clone()
    new_element.removeAttr('id')

    new_element.find('.target-name').text(target)

    new_element.prependTo('#target_list')
    new_element.web_target = target
    g_target_map[target] = new_element

    new_element.click(on_select_target.bind(null, target))

    new_element.contextmenu(function (e) {
        e.preventDefault()
        const menu = new Menu()

        menu.append(new MenuItem({
            label: utils.lg('删除', 'Remove'),
            click: on_click_remove_target.bind(null, new_element)
        }))

        menu.popup({ window: remote.getCurrentWindow() })
    })

}

function on_click_open_in_browser(target_element) {
    electron.remote.shell.openExternal(target_element.web_target.desc)
}

function send_cmd(data) {
    electron.ipcRenderer.send('cmd', data)
}

function on_click_check_immediately(target_element) {
    send_cmd({ 'cmd': 'check-immediately', data: target_element.web_target.id })
}

let g_under_removing_target_element = null

function on_click_remove_target(target_element) {
    let target = target_element.web_target
    if (confirm(`${utils.lg('删除', 'Remove')} ${target} ?`)){
        mystore.remove_target(target)
        reload_targets()
    }
}

function on_click_remove_module(module_element) {
    var r = confirm(`删除模块 ${module_element.web_module.name} ?`)
    if (r == true) {
        electron.ipcRenderer.send('remove-module', module_element.web_module.id)
    }
}

electron.ipcRenderer.on("remove-module", (e, module_id) => {
    g_module_map[module_id].remove()
    delete g_module_map[module_id]
})

let g_under_delete_modules_element = null

function on_click_delete_modules(target_element) {
    g_under_delete_modules_element = target_element
    $('#delete_modules_dialog').find('#delete_modules_target_name').text(target_element.web_target.name)
    $('#delete_modules_dialog').modal('show')
}

function on_click_mark_all_read(target_element) {
    if (g_selected_target_element == target_element) {
        $('.module').find('.module-indication').attr('type', '1')
    }

    target_element.find('.target-indication').attr('indication', 'false')

    electron.ipcRenderer.send('mark-all-read', target_element.web_target.id)
}

function on_click_remove_target_confirm() {
    $('#remove_target_dialog').modal('hide')

    if (g_under_removing_target_element == g_selected_target_element) {
        unselect_target()
    }
    g_under_removing_target_element.remove()
    electron.ipcRenderer.send('remove-target', g_under_removing_target_element.web_target.id)
    g_under_config_target_element = null
}

function on_click_delete_modules_confirm() {
    $('#delete_modules_dialog').modal('hide')
    $('#module_list').empty()
    electron.ipcRenderer.send('delete-modules', g_under_delete_modules_element.web_target.id)
    g_under_delete_modules_element = null
}

function on_click_toggle_pause_target(target_element) {
    console.log('click pause/resume target')
    target_element.web_target.state = target_element.web_target.state == utils.target_STATE.NORMAL ? utils.target_STATE.PAUSED : utils.target_STATE.NORMAL
    target_element.find('.target-paused').attr('paused', target_element.web_target.state == utils.target_STATE.NORMAL ? "false" : "true")
    electron.ipcRenderer.send('set-target-state', {
        target_id: target_element.web_target.id,
        state: target_element.web_target.state
    })
}

function on_click_toggle_mute_target(target_element) {
    console.log('click mute/unmute target')
    target_element.web_target.muted = target_element.web_target.muted == 0 ? 1 : 0
    target_element.find('.target-muted').attr('muted', target_element.web_target.muted == 0 ? "false" : "true")
    electron.ipcRenderer.send('set-target-muted', {
        target_id: target_element.web_target.id,
        state: target_element.web_target.muted
    })
}

electron.ipcRenderer.on('open-new-target', function (e, data) {
    on_click_new_target()
})


electron.ipcRenderer.on('new-target', function (e, target) {
    add_new_target_element(target)
})

electron.ipcRenderer.on('all-targets', function (e, data) {
    console.log('all targets', data)
    data.targets.forEach((target, index) => {
        add_new_target_element(target)
    })
})

electron.ipcRenderer.on('new-target-icon', function (e, data) {
    console.log('new-target-icon', data)
    g_target_map[data.target_id].find('.target-image').attr('src', data.icon)
})

electron.ipcRenderer.on('target-update', function (e, data) {
    console.log('target-update', data)
    let element = g_target_map[data.id]
    element.find('.target-name').text(data.name)
    element.find('.target-desc').text(data.desc)
    element.web_target.name = data.name
    element.web_target.desc = data.desc
})

let g_selected_target_element = null

function on_select_target(target_id) {

    $('#help_space').hide()
    $('#module_space').show()
    $('#content_space').show()

    let element = g_target_map[target_id]
    let target = element.web_target
    console.log('click select element', target.name, target.id)

    if (g_selected_target_element == element) {
        return
    }

    if (g_selected_target_element) {
        g_selected_target_element.attr('select', 'false')
    }

    element.attr('select', 'true')
    g_selected_target_element = element

    $('#module_list').empty()
    g_module_map = {}

    electron.ipcRenderer.send('get-all-modules', target.id)
}

function unselect_target() {
    g_selected_module_element = null
    g_selected_target_element = null
    $('#module_list').empty()
    $('#html_diff').empty()
}

function on_click_new_target() {
    let folder_name = electron.remote.dialog.showOpenDialog({properties: ['openDirectory']})
    console.log(folder_name)
    if (folder_name && folder_name.length > 0) {
        folder_name = folder_name[0]
        if (mystore.get_targets().indexOf(folder_name) != -1) {
            alert(utils.lg('这个文件夹早就被加入了', 'This folder has already been added'))
        } else {
            mystore.add_target(folder_name)
        }
    }

    reload_targets()
}


function on_click_new_module() {
    console.log('click new module')
    electron.ipcRenderer.send('new-module', {
        id: uuidgen(),
        target_id: g_selected_target_element.web_target.id,
        name: "unamed module",
        doc: '',
        config: '{}',
        codeout: '',
        codein: '',
        extra: '',
        count: 0,
        state: 0,
        date: Date.now(),
        data: ''
    })
}

/* modules */
electron.ipcRenderer.on('all-modules', function (e, modules) {
    console.log('all modules', modules)
    modules.forEach(function (module) {
        add_new_module_element(module)
    })
})

electron.ipcRenderer.on('new-module', function (e, module) {
    console.log('new module', module)
    add_new_module_element(module, true)
})

let g_module_map = {}

function add_new_module_element(module, at_top = false) {

    let root = g_selected_target_element.web_target.id == 'root'
    let new_element = $('#module_template').clone()
    new_element.removeAttr('id')
    new_element.find('.module-name').text(module.name)
    new_element.find('.module-id').text(module.id.slice(0, 8).toUpperCase())
    new_element.attr('title', module.id)

    new_element.web_module = module
    if (at_top) {
        new_element.prependTo('#module_list')
    } else {
        new_element.appendTo('#module_list')
    }

    g_module_map[module.id] = new_element
    new_element.click(on_select_module.bind(null, module.id))

    new_element.contextmenu(function (e) {
        e.preventDefault()
        const menu = new Menu()

        menu.append(new MenuItem({
            label: utils.lg('删除', 'Delete'),
            click: on_click_remove_module.bind(null, new_element)
        }))

        menu.popup({ window: remote.getCurrentWindow() })
    })
}

let g_selected_module_element = null

function on_select_module(module_id) {
    let element = g_module_map[module_id]
    let module = element.web_module

    if (g_selected_module_element == element) {
        //same one, pass
        return
    }

    //unselect current
    if (g_selected_module_element) {
        g_selected_module_element.attr('select', 'false')
    }

    //select new
    element.attr('select', 'true')
    g_selected_module_element = element

    $('#head_module_id').text(module.id.slice(0, 8).toUpperCase())
    $('#input_module_name').val(module.name)

    g_editor_codeout.setValue(module.codeout)
    g_editor_codein.setValue(module.codein)
    g_editor_doc.setValue(module.doc)
    g_dirty = false
    refresh_save_dirty()
}
electron.ipcRenderer.on('menu-save-module', on_click_save_module)
function on_click_save_module() {
    console.log('save module')
    if (g_selected_module_element) {
        if (g_dirty) {
            g_dirty = false
            refresh_save_dirty()

            let module = g_selected_module_element.web_module
            module.name = $('#input_module_name').val()
            module.doc = g_editor_doc.getValue()
            module.codein = g_editor_codein.getValue()
            module.codeout = g_editor_codeout.getValue()
            g_selected_module_element.find('.module-name').text(module.name)

            electron.ipcRenderer.send('update-module', module)
        }
    } else {
        alert('没有选中任何模块')
    }
}

function on_module_name_change() {
    if (g_selected_module_element) {
        g_dirty = true
        refresh_save_dirty()
    }
}

electron.ipcRenderer.on('menu-play-module', on_click_play_module)
function on_click_play_module() {
    if (g_selected_module_element) {
        electron.ipcRenderer.send('play-module', g_selected_module_element.web_module.id)
    } else {
        alert('没有选中任何模块')
    }
}

