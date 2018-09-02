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
const fs = require('fs')

window.onresize = function (e) {
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("init window");
    locale.init();

    reload_targets()

    $('#btn_add_target').click(on_click_new_target)
    $('#btn_add_record').click(on_click_new_record)

    $('#btn_add_new_target').click(on_click_new_target)
    $('#btn_remove_target_confirm').click(on_click_remove_target_confirm)
    $('#btn_delete_records_confirm').click(on_click_delete_records_confirm)

    $('#btn_open_settings').click(function () {
        electron.ipcRenderer.send('open-settings')
    })

    $('iframe').attr('src', "http://label4ml.netqon.com/embedded.html?t=" + new Date().getTime())

    $('.head-tab').click(on_click_head_tab)

    $('#btn_record_save').click(on_click_save_record)

    $('#input_record_name').keydown(on_record_name_change)

    $('#btn_record_play').click(on_click_play_record)
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

function on_click_remove_record(record_element) {
    var r = confirm(`删除模块 ${record_element.web_record.name} ?`)
    if (r == true) {
        electron.ipcRenderer.send('remove-record', record_element.web_record.id)
    }
}

electron.ipcRenderer.on("remove-record", (e, record_id) => {
    g_record_map[record_id].remove()
    delete g_record_map[record_id]
})

let g_under_delete_records_element = null

function on_click_delete_records(target_element) {
    g_under_delete_records_element = target_element
    $('#delete_records_dialog').find('#delete_records_target_name').text(target_element.web_target.name)
    $('#delete_records_dialog').modal('show')
}

function on_click_mark_all_read(target_element) {
    if (g_selected_target_element == target_element) {
        $('.record').find('.record-indication').attr('type', '1')
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

function on_click_delete_records_confirm() {
    $('#delete_records_dialog').modal('hide')
    $('#record_list').empty()
    electron.ipcRenderer.send('delete-records', g_under_delete_records_element.web_target.id)
    g_under_delete_records_element = null
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

function on_select_target(target) {

    $('#help_space').hide()
    $('#record_space').show()
    $('#content_space').show()

    let element = g_target_map[target]
    console.log('click select element', target)

    if (g_selected_target_element == element) {
        return
    }

    if (g_selected_target_element) {
        g_selected_target_element.attr('select', 'false')
    }

    element.attr('select', 'true')
    g_selected_target_element = element

    $('#record_list').empty()
    g_record_map = {}

    reload_target_records()
}

let IMG_EXT_LIST = ['png','jpg', 'jpeg', 'bmp', 'gif', 'webp']
function reload_target_records() {
    let target = g_selected_target_element.web_target
    console.log('reload target reocrds', target)

    if (!fs.existsSync(target)) {
        alert(`${target} ${utils.lg('不存在', "doesn't exist")}`)
        return
    }


    fs.readdir(target, (err, files) => {
        files.forEach(file => {
            console.log(file);
            let ext = utils.get_file_ext(file)
            if (IMG_EXT_LIST.indexOf(ext) != -1) {
                //is image
                add_new_record_element(file)
            }
        });
        //TODO should check file is real file
        //https://stackoverflow.com/questions/2727167/how-do-you-get-a-list-of-the-names-of-all-files-present-in-a-directory-in-node-j
    })
}

function unselect_target() {
    g_selected_record_element = null
    g_selected_target_element = null
    $('#record_list').empty()
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


function on_click_new_record() {
    console.log('click new record')
    electron.ipcRenderer.send('new-record', {
        id: uuidgen(),
        target_id: g_selected_target_element.web_target.id,
        name: "unamed record",
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

/* records */
electron.ipcRenderer.on('all-records', function (e, records) {
    console.log('all records', records)
    records.forEach(function (record) {
        add_new_record_element(record)
    })
})

electron.ipcRenderer.on('new-record', function (e, record) {
    console.log('new record', record)
    add_new_record_element(record, true)
})

let g_record_map = {}

function add_new_record_element(record) {

    let new_element = $('#record_template').clone()
    new_element.removeAttr('id')
    new_element.find('.record-name').text(record)
    // new_element.find('.record-id').text(record.id.slice(0, 8).toUpperCase())
    // new_element.attr('title', record.id)

    new_element.web_record = record
    new_element.appendTo('#record_list')

    g_record_map[record] = new_element
    new_element.click(on_select_record.bind(null, record))

    // new_element.contextmenu(function (e) {
    //     e.preventDefault()
    //     const menu = new Menu()

    //     menu.append(new MenuItem({
    //         label: utils.lg('删除', 'Delete'),
    //         click: on_click_remove_record.bind(null, new_element)
    //     }))

    //     menu.popup({ window: remote.getCurrentWindow() })
    // })
}

let g_selected_record_element = null

function on_select_record(record_id) {
    let element = g_record_map[record_id]
    let record = element.web_record

    if (g_selected_record_element == element) {
        //same one, pass
        return
    }

    //unselect current
    if (g_selected_record_element) {
        g_selected_record_element.attr('select', 'false')
    }

    //select new
    element.attr('select', 'true')
    g_selected_record_element = element

    $('#head_record_id').text(record.id.slice(0, 8).toUpperCase())
    $('#input_record_name').val(record.name)

    g_editor_codeout.setValue(record.codeout)
    g_editor_codein.setValue(record.codein)
    g_editor_doc.setValue(record.doc)
    g_dirty = false
    refresh_save_dirty()
}
electron.ipcRenderer.on('menu-save-record', on_click_save_record)
function on_click_save_record() {
    console.log('save record')
    if (g_selected_record_element) {
        if (g_dirty) {
            g_dirty = false
            refresh_save_dirty()

            let record = g_selected_record_element.web_record
            record.name = $('#input_record_name').val()
            record.doc = g_editor_doc.getValue()
            record.codein = g_editor_codein.getValue()
            record.codeout = g_editor_codeout.getValue()
            g_selected_record_element.find('.record-name').text(record.name)

            electron.ipcRenderer.send('update-record', record)
        }
    } else {
        alert('没有选中任何模块')
    }
}

function on_record_name_change() {
    if (g_selected_record_element) {
        g_dirty = true
        refresh_save_dirty()
    }
}

electron.ipcRenderer.on('menu-play-record', on_click_play_record)
function on_click_play_record() {
    if (g_selected_record_element) {
        electron.ipcRenderer.send('play-record', g_selected_record_element.web_record.id)
    } else {
        alert('没有选中任何模块')
    }
}

