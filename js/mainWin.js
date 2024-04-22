/**
 * 主界面 Main Window 脚本
 * 程序一打开显示的界面
 */

const { ipcRenderer } = require('electron');
const path = require('path')
// 默认打开的文件夹参数（强迫症行为）
const friendlyDefaultPath = `.${path.join('a', 'assets', 'demo', 'chinese').replace('a','')}`
const defaultPath = path.join(__dirname.replace('/app.asar','').replace('html',''), 'assets', 'demo', 'chinese')
var folderPath = defaultPath

// 全局延时函数（异步）
function setDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// 清除当前界面中的所有文件列表和点击事件
function emptyFileListAndListener() {
    const rpyFileList = document.getElementById('file_list')
    while (rpyFileList.firstChild) {
        rpyFileList.removeChild(rpyFileList.firstChild)
    }
}

// 接收主进程返回的选择的文件夹
ipcRenderer.on('selectedFolderPath', (event, path) => {
    emptyFileListAndListener()
    folderPath = path
    setDelay(200).then(() => {
        ipcRenderer.send('getRpyFiles', folderPath)
    })
})

// 接收主进程返回的 .rpy 列表
ipcRenderer.on('rpyFilesList', (event, listContent) => {
    const rpyFileList = document.getElementById('file_list')
    document.getElementById('folder_path').innerText = folderPath
    if (listContent.error) {
        rpyFileList.innerHTML = `<li>加载出错: ${listContent.error}</li>`
    } else {
        listContent.files.forEach(file => {
            const li = document.createElement('li')
            li.textContent = file
            li.addEventListener('click', () => {
                ipcRenderer.send('openRpyFile', file)
            })
            rpyFileList.appendChild(li)
        })
    }
    // 启动时加载的文件夹的友好显示
    if (folderPath === defaultPath) {
        document.getElementById('folder_path').innerText = friendlyDefaultPath
    }
})

// 接收主进程返回的问候语
ipcRenderer.on('receiveGreetingTips', (event, greetingTips) => {
    document.getElementById('head_title').innerText = greetingTips
})

// 启动后的加载内容
window.addEventListener('DOMContentLoaded', () => {
    // 向主进程请求获取问候语
    ipcRenderer.send('getGreetingTips')
    // 向主进程请求获取目标目录下的 .rpy 文件
    ipcRenderer.send('getRpyFiles', folderPath)
    // 加载字体
    let fontPath = null
    if (process.defaultApp) {
        fontPath = '../../assets/font/Cabin.ttf'
    } else {
        fontPath = '../assets/font/Cabin.ttf'
    }
    const style = document.createElement('style');
    style.innerHTML = `@font-face {
        font-family: 'CustomFont';
        src: url('${fontPath}') format('truetype');
    }`
    document.head.appendChild(style)
})