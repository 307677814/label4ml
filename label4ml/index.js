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

    $('#btn_add_label').click(on_click_add_label)
    $('#btn_delete_label').click(on_click_delete_label)

    $('#btn_save').click(on_click_save)
})


function reload_targets() {
    let targets = mystore.get_targets()
    console.log('targets', targets)

    $('#target_list').empty()
    g_target_map = {}

    targets.forEach(target => {
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

        menu.append(new MenuItem({
            label: utils.lg('查看', 'Reveal'),
            click: ()=>{
                electron.remote.shell.openItem(target)
            }
        }))

        menu.popup({ window: remote.getCurrentWindow() })
    })
}

function send_cmd(data) {
    electron.ipcRenderer.send('cmd', data)
}

function on_click_remove_target(target_element) {
    let target = target_element.web_target
    if (confirm(`${utils.lg('删除', 'Remove')} ${target} ?`)) {
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

let IMG_EXT_LIST = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp']
function reload_target_records() {
    let target = g_selected_target_element.web_target
    console.log('reload target reocrds', target)

    if (!fs.existsSync(target)) {
        alert(`${target} ${utils.lg('不存在', "doesn't exist")}`)
        return
    }


    fs.readdir(target, (err, files) => {
        files.forEach(file => {
            // console.log(file);
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
    let folder_name = electron.remote.dialog.showOpenDialog({ properties: ['openDirectory'] })
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

    reload_record(record)
}

let g_stage = null;
let g_layer = null;
let g_stage_width = 3000;
let g_stage_height = 3000;
let g_image = null
let g_yoda = null
let g_selected_label_rect = null
function init_board() {
    g_stage = new Konva.Stage({
        container: 'container',
        width: g_stage_width,
        height: g_stage_height
    });

    // add canvas element
    g_layer = new Konva.Layer();
    g_stage.add(g_layer);

    let imageObj = new Image();
    g_image = imageObj;
    setTimeout(() => {
        g_yoda = new Konva.Image({
            x: 0,
            y: 0,
            image: imageObj,
            width: imageObj.width,
            height: imageObj.height
        });
        g_layer.add(g_yoda);
        g_layer.draw();

        g_stage.width(imageObj.width)
        g_stage.height(imageObj.height)
        $('#info_image_size').text(`size=${imageObj.width}x${imageObj.height}`)
    }, 500);

    imageObj.src = '../test-images/a.jpg';

    g_layer.draw();
    setTimeout(refresh_stage_size, 1000)
    window.addEventListener('resize', refresh_stage_size);

    let scaleBy = 1.05;


    g_stage.on('click', function (e) {
        // if click on empty area - remove all transformers
        if (e.target === g_stage) {
            g_stage.find('Transformer').destroy();
            g_layer.draw();
          return;
        }
        // do nothing if clicked NOT on our rectangles
        if (!e.target.hasName('label')) {
          g_stage.find('Transformer').destroy();
          g_layer.draw();
          return;
        }
        // remove old transformers
        // TODO: we can skip it if current rect is already selected
        g_stage.find('Transformer').destroy();
  
        // create new transformer
        var tr = new Konva.Transformer({
            rotateEnabled: false
        });
        g_layer.add(tr);
        tr.attachTo(e.target);
        g_layer.draw();
        g_selected_label_rect = e.target;
        make_dirty()
      })

    document.getElementById('content_space').addEventListener('wheel', (e) => {
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
        $('#info_scale').text(`${Math.round(1000 * g_stage.scaleX()) / 1000}`)

    });

    document.getElementById('content_space').addEventListener('mousemove', (event) => {
        // console.log(event)
        let pos = get_real_pos()
        if (pos) {
            $('#info_cursor_pos').text(`x:${Math.round(pos.x)}, y:${Math.round(pos.y)}`);
        }
        $('#info_scale').text(`${Math.round(1000 * g_stage.scaleX()) / 1000}`)
        on_mousemove_add_label_routine()
    })


    document.getElementById('content_space').addEventListener('click', (event) => {
        console.log(event)

        on_click_routine_add_label(event)
    })
}


function get_real_pos() {

    let stage_pointer_pos = g_stage.getPointerPosition();
    let stage_pos = g_stage.getPosition();
    if (stage_pos && stage_pointer_pos) {
        let scale = g_stage.scaleX()
        let image_x = stage_pointer_pos.x - stage_pos.x;
        let image_y = stage_pointer_pos.y - stage_pos.y;
        image_x = image_x / scale;
        image_y = image_y / scale;
        // console.log(image_x, image_y);
        return { x: image_x, y: image_y }
    } else {
        return null
    }
}

function refresh_stage_size() {
    let container_parent = document.getElementById('content_space')

    let containerWidth = container_parent.offsetWidth;
    console.log("size", containerWidth)

    let scale_x = container_parent.offsetWidth / g_image.width;
    let scale_y = container_parent.offsetHeight / g_image.height;
    let scale = Math.min(scale_x, scale_y)
    g_stage.width(container_parent.offsetWidth);
    g_stage.height(container_parent.offsetHeight);
    g_stage.scale({ x: scale, y: scale });
    g_stage.draw();
    g_stage.position({ x: 0, y: 0 });
    $('#info_scale').text(`${Math.round(1000 * g_stage.scaleX()) / 1000}`)

}

function reload_record(record) {
    g_layer.removeChildren()
    g_image = new Image();
    g_image.src = 'file://' + g_selected_target_element.web_target + '/' + record;

    g_image.onload = () => {
        g_yoda = new Konva.Image({
            x: 0,
            y: 0,
            image: g_image,
            width: g_image.width,
            height: g_image.height
        });
        g_layer.add(g_yoda);
        g_layer.draw();

        g_stage.width(g_image.width)
        g_stage.height(g_image.height)
        $('#info_image_size').text(`size=${g_image.width}x${g_image.height}`)
        refresh_stage_size()
    }
    g_layer.draw();


    if (fs.existsSync(get_current_label_file())) {
        fs.readFile(get_current_label_file(), (err, data)=>{
            let text = data.toString()
            console.log(text)
            let lines = text.split('\n')
            lines.forEach(line=>{
                let ww = line.split(',')
                if (ww.length == 4){
                    add_new_label(parseInt(ww[0]),parseInt(ww[1]),parseInt(ww[2]),parseInt(ww[3]))
                }
            })
        })
    }
}

function init_keys() {
    window.addEventListener('keydown', function (event) {
        // console.log(event)
        switch (event.keyCode) {
            case 32:
                enter_space_drag();
                break
        }
    })


    window.addEventListener('keyup', function (event) {
        // console.log(event)
        switch (event.keyCode) {
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

let ADD_LABEL_STATE = {
    IDLE: 0,
    TO_START: 1,
    TO_END: 2
}

let g_add_label_state = ADD_LABEL_STATE.IDLE
let g_start_pos = null
let g_add_label_rect = null
let g_add_label_text = null
function on_click_add_label() {
    //开始增加一个节点
    if (g_selected_target_element && g_selected_record_element) {
        g_add_label_state = ADD_LABEL_STATE.TO_START
    }
}

function on_click_delete_label() {
    console.log("delete label", g_selected_label_rect)
    if (g_selected_label_rect) {
        g_selected_label_rect.destroy()
        g_stage.find('Transformer').destroy();
        g_layer.draw()
        make_dirty()
    }
}

function gp(ft) {
    return Math.round(ft)
}

function on_click_routine_add_label(event) {
    let pos = get_real_pos();
    if (pos) {
        if (g_add_label_state == ADD_LABEL_STATE.TO_START) {
            g_start_pos = pos;
            g_add_label_state = ADD_LABEL_STATE.TO_END;
            let tmp_pos = get_real_pos()


            g_add_label_rect = new Konva.Rect({
                x: tmp_pos.x,
                y: tmp_pos.y,
                width: 0,
                height: 0,
                stroke: 'red',
                strokeWidth: 2
            });


            g_add_label_text = new Konva.Text({
                x: tmp_pos.x,
                y: tmp_pos.y-30,
                text: `w:0,h:0`,
                fontSize: 30,
                fill: 'orange',
                fontFamily: 'Calibri'
            });

            // add the shape to the layer
            g_layer.add(g_add_label_rect);
            g_layer.add(g_add_label_text);
            g_layer.draw()

        } else if (g_add_label_state == ADD_LABEL_STATE.TO_END) {
            console.log('end at', pos)
            g_add_label_state = ADD_LABEL_STATE.IDLE
            g_add_label_rect.destroy()
            g_add_label_text.destroy()
            g_layer.draw()
            let tmp_pos = get_real_pos()
            add_new_label(g_start_pos.x, g_start_pos.y, tmp_pos.x - g_start_pos.x, tmp_pos.y - g_start_pos.y)
            make_dirty()
        }
    }
}

function on_mousemove_add_label_routine() {
    if (g_add_label_state == ADD_LABEL_STATE.TO_END) {
        let tmp_pos = get_real_pos()
        g_add_label_rect.width(tmp_pos.x - g_start_pos.x)
        g_add_label_rect.height(tmp_pos.y - g_start_pos.y)

        g_add_label_text.text(`w:${gp(tmp_pos.x - g_start_pos.x)},h:${gp(tmp_pos.y - g_start_pos.y)}`)

        g_layer.draw()
    }
}

function add_new_label(x,y,w,h) {

    let label_rect = new Konva.Rect({
        x: x,
        y: y,
        width: w,
        height: h,
        fill: 'blue',
        // fillEnabled: false,
        stroke: 'red',
        strokeWidth: 3,
        opacity: 0.5,
        draggable: true,
        name: 'label'
    });
    label_rect.on('dragend', function() {
        make_dirty()
    });
    g_layer.add(label_rect)
    g_layer.draw()

}

let g_dirty  = false
function make_dirty() {
    g_dirty = true
    on_dirty_change()
}
function on_dirty_change() {
    if (g_dirty){
        $('#btn_save').css('background', 'red')
        $('#btn_save').css('color', 'white')
    } else {
        $('#btn_save').removeAttr('style')
    }
}

function get_current_label_file() {
   return path.join(g_selected_target_element.web_target, g_selected_record_element.web_record + '.label')
}

function on_click_save() {
    g_dirty = false
    on_dirty_change()

    let label_rects = g_stage.find('.label')
    let data = ''
    label_rects.each(function(label_rect){
        console.log(label_rect)
        console.log(label_rect.x(), label_rect.y(), label_rect.width(), label_rect.height())
        data += `${Math.round(label_rect.x())},${Math.round(label_rect.y())},${Math.round(label_rect.width()*label_rect.scaleX())},${Math.round(label_rect.height()*label_rect.scaleY())}\n`
    })
    fs.writeFile(get_current_label_file(), data, ()=>{
        console.log('writed')
    })
}