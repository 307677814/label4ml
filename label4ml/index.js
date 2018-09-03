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
    init_board()
    init_keys()

    $('#btn_add_target').click(on_click_new_target)

    $('#btn_open_settings').click(function () {
        electron.ipcRenderer.send('open-settings')
    })

    $('iframe').attr('src', "http://label4ml.netqon.com/embedded.html?t=" + new Date().getTime())

    $('.head-tab').click(on_click_head_tab)
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

function send_cmd(data) {
    electron.ipcRenderer.send('cmd', data)
}

function on_click_remove_target(target_element) {
    let target = target_element.web_target
    if (confirm(`${utils.lg('删除', 'Remove')} ${target} ?`)){
        mystore.remove_target(target)
        reload_targets()
    }
}

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

let g_record_map = {}

function add_new_record_element(record) {

    let new_element = $('#record_template').clone()
    new_element.removeAttr('id')
    new_element.find('.record-name').text(record)

    new_element.web_record = record
    new_element.appendTo('#record_list')

    g_record_map[record] = new_element
    new_element.click(on_select_record.bind(null, record))

}

let g_selected_record_element = null

function on_select_record(record) {
    let element = g_record_map[record]

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

    reload_target_records(record)
}

let g_stage = null;
let g_stage_width = 1000;
let g_stage_height = 1000;

function init_board() {
    g_stage = new Konva.Stage({
        container: 'container',
        width: g_stage_width,
        height: g_stage_height
    });

    // add canvas element
    let layer = new Konva.Layer();
    g_stage.add(layer);



    let imageObj = new Image();
    imageObj.onload = function() {

      let yoda = new Konva.Image({
        x: 0,
        y: 0,
        image: imageObj,
        width: imageObj.width,
        height: imageObj.height
      });
      layer.add(yoda);
      layer.draw();
    }

    imageObj.src = '../test-images/a.jpg';

    layer.draw();
    refresh_stage_size()
    window.addEventListener('resize', refresh_stage_size);


    let scaleBy = 1.05;
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        let oldScale = g_stage.scaleX();

        let mousePointTo = {
            x: g_stage.getPointerPosition().x / oldScale - g_stage.x() / oldScale,
            y: g_stage.getPointerPosition().y / oldScale - g_stage.y() / oldScale,
        };

        let newScale = e.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;
        g_stage.scale({ x: newScale, y: newScale });

        let newPos = {
            x: -(mousePointTo.x - g_stage.getPointerPosition().x / newScale) * newScale,
            y: -(mousePointTo.y - g_stage.getPointerPosition().y / newScale) * newScale
        };
        g_stage.position(newPos);
        g_stage.batchDraw();
    });
}

function refresh_stage_size() {
    let container_parent = document.getElementById('content_space')

    let containerWidth = container_parent.offsetWidth;
    console.log("size", containerWidth)

    let scale = containerWidth / g_stage_width;


    g_stage.width(g_stage_width * scale);
    g_stage.height(g_stage_height * scale);
    g_stage.scale({ x: scale, y: scale });
    g_stage.draw();
    g_stage.position({x:0, y:0});

}

function reload_record(record) {
}


function init_keys() {
    window.addEventListener('keydown', function(event){
        // console.log(event)
        switch(event.keyCode){
            case 32:
                enter_space_drag();
                break
        }
    })


    window.addEventListener('keyup', function(event){
        // console.log(event)
        switch(event.keyCode) {
            case 32:
                exit_space_drag();
                break
        }
    })
}

function enter_space_drag() {
    g_stage.draggable(true)
    $('#container').css('cursor', 'move')
}

function exit_space_drag() {
    g_stage.draggable(false)
    $('#container').css('cursor', 'default')

}

