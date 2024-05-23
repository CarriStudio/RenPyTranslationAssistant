/**
 * 主进程 Main Process 脚本
 * “万物的根源”
 */

// 引用的模块和全局变量
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron/main')
const fs = require('fs')
const path = require('path')
var rpyFolderPath = null
var rpyFilesList = null
var mainWin = null
var editWin = null
var batchWin = null
var currentFile = null
var autoSaveInterval = null
var autoSaveEnabled = true
// 应用信息
const appIconPath = path.join(__dirname.replace('/app.asar','').replace('js',''), 'assets', 'icon', 'icon.png')
const appConfigFilePath = path.join(app.getPath('userData'), 'RTA_Config.json');
const appHelpDocument = `https://github.com/CarriStudio/RenPyTranslationAssistant`
const appGlobalName = `Ren'Py 翻译助手`
const appGlobalVersion = `Beta 0.1.5`
const appDescription = `一个好用的翻译「由 Ren'Py 制作的视觉游戏」的工具`

// 全局通用右键菜单项
const rightMenuContent = [
    { label: '撤销', role: 'undo' },
    { label: '重做', role: 'redo' },
    { type: 'separator' },
    { label: '剪切', role: 'cut' },
    { label: '复制', role: 'copy' },
    { label: '粘贴', role: 'paste' },
]
const rightMenu = Menu.buildFromTemplate(rightMenuContent)

// 创建主窗口
const createMainWindow = () => {
    mainWin = new BrowserWindow({
        width: 420,
        height: 618,
        show: false,    // 体验增强
        minWidth: 420,
        minHeight: 618,
        resizable: true,
        icon: appIconPath,
        webPreferences: {
            // 允许渲染进程直接使用 Node.js
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: ['--allow-file-access-from-files'] // 允许从文件加载资源
        }
    })
    // 菜单栏内容
    let mainWinMenuList = [
        {
            label: '文件(&F)(F)',
            submenu: [
                { label: '打开文件夹', accelerator: 'CmdOrCtrl+O', click() { chooseFolder(mainWin, 'chooseRpyFolder', '选择目标 .rpy 文件夹') } },
                { type: 'separator' },
                { label: '批量操作', accelerator: 'CmdOrCtrl+B', click() { createBatchWindow() } },
                { type: 'separator' },
                {
                    label: '退出',
                    click() {
                        mainWin.close()
                    }
                },
            ]
        },
        {
            label: '帮助(&H)(H)',
            submenu: [
                { label: '帮助信息', accelerator: 'CmdOrCtrl+H', click() { shell.openExternal(appHelpDocument) } },
                { type: 'separator' },
                { label: '开发人员工具', role: 'toggleDevTools' },
                { label: '关于', role: 'about' },
            ]
        },
    ]
    // 创建菜单栏
    Menu.setApplicationMenu(Menu.buildFromTemplate(mainWinMenuList))
    // 加载页面文件
    mainWin.loadFile('html/mainWin.html')
    // 利用 ready-to-show 配合上面的 show: false 实现更贴近原生软件的窗口展示体验
    mainWin.on('ready-to-show', () => {
        mainWin.show()
        mainWin.setTitle(`${appGlobalName} (${appGlobalVersion})`)
    })
    // 页面关闭事件
    mainWin.on('close', () => {
        app.quit()
    })
}

// 创建编辑窗口
const createEditWindow = () => {
    editWin = new BrowserWindow({
        width: 1000,
        height: 618,
        show: false,    // 配合下方体验增强
        minWidth: 1000,
        minHeight: 618,
        resizable: true,
        icon: appIconPath,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
    // 菜单栏内容
    let editWinMenuList = [
        {
            label: '文件(&F)(F)',
            submenu: [
                { label: '保存', accelerator: 'CmdOrCtrl+S', click() { editWin.webContents.send('saveChanges', 0) } },
                { label: '重新加载', accelerator: 'CmdOrCtrl+R', click() { editWin.destroy(); editRpyFileFun(currentFile) } },
                // { type: 'separator' },
                // { label: '导入翻译文本', accelerator: 'CmdOrCtrl+I', click() { chooseImportFile() } },
                // { label: '导出翻译用表格 ...', submenu: [
                //     { label: '为 UTF-8 的 TSV 格式', click() { editWin.webContents.send('exportTSVSheet') } }
                // ] },
                { type: 'separator' },
                {
                    label: '关闭',
                    click() { editWin.close() }
                },
            ]
        },
        {
            label: '编辑(&E)(E)',
            submenu: [
                { label: '撤销', role: 'undo' },
                { label: '重做', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', role: 'cut' },
                { label: '复制', role: 'copy' },
                { label: '粘贴', role: 'paste' },
            ]
        },
        {
            label: '选项(&O)(O)',
            submenu: [
                { 
                    label: '自动保存', 
                    type: 'checkbox', 
                    checked: autoSaveEnabled, 
                    click: () => {
                        autoSaveEnabled = !autoSaveEnabled
                        autoSaveFunction()
                    }
                },
            ]
        },
        {
            label: '帮助(&H)(H)',
            submenu: [
                { label: '帮助信息', accelerator: 'CmdOrCtrl+H', click() { shell.openExternal(appHelpDocument) } },
                { type: 'separator' },
                { label: '开发人员工具', role: 'toggleDevTools' },
            ]
        },
    ]
    // 创建菜单栏
    editWin.setMenu(Menu.buildFromTemplate(editWinMenuList))
    // 加载页面文件
    editWin.loadFile('html/editWin.html')
    // 体验增强
    editWin.on('ready-to-show', () => {
        editWin.show()
    })
    // 创建右键菜单
    editWin.webContents.on('context-menu', () => {
        rightMenu.popup()
    })
    // 在页面加载后，自动开启开发者工具
    // editWin.webContents.openDevTools()
    // 页面关闭的 close 事件
    editWin.on('close', (event) => {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval)
        }
        event.preventDefault()
        editWin.webContents.send('saveChanges', 1)
    })
}

// 创建批量操作窗口
const createBatchWindow = () => {
    batchWin = new BrowserWindow({
        width: 350,
        height: 450,
        show: false,    // 配合下方体验增强
        minWidth: 350,
        minHeight: 450,
        resizable: true,
        icon: appIconPath,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
    // 菜单栏内容
    let batchWinMenuList = [
        {
            label: '文件(&F)(F)',
            submenu: [
                {
                    label: '关闭',
                    click() { batchWin.close() }
                },
            ]
        },
        {
            label: '帮助(&H)(H)',
            submenu: [
                { label: '帮助信息', accelerator: 'CmdOrCtrl+H', click() { shell.openExternal(appHelpDocument) } },
                { type: 'separator' },
                { label: '开发人员工具', role: 'toggleDevTools' },
            ]
        },
    ]
    // 创建菜单栏
    batchWin.setMenu(Menu.buildFromTemplate(batchWinMenuList))
    // 加载页面文件
    batchWin.loadFile('html/batchWin.html')
    // 体验增强
    batchWin.on('ready-to-show', () => {
        batchWin.show()
        batchWin.webContents.send('scanTargetFolder', rpyFolderPath, rpyFilesList)
    })
    // 创建右键菜单
    batchWin.webContents.on('context-menu', () => {
        rightMenu.popup()
    })
    // 在页面加载后，自动开启开发者工具
    // batchWin.webContents.openDevTools()
    // 页面关闭的 close 事件
    // batchWin.on('close', (event) => {
    //     event.preventDefault()
    // })
}

// 创建默认配置文件
function createDefaultConfigFile() {
    const defaultConfig = {
        autoSave: true,
        rpyFolderPath: '',
    }
    fs.writeFileSync(appConfigFilePath, JSON.stringify(defaultConfig))
    return defaultConfig
}

// 读取配置文件
function loadConfigFile() {
    try {
        const data = fs.readFileSync(appConfigFilePath)
        return JSON.parse(data)
    } catch (error) {
        // 如果配置文件不存在或读取失败，则创建并返回默认配置
        return createDefaultConfigFile()
    }
}

// 使配置参数生效
function enableConfig(configData) {
    if (configData.autoSave !== undefined) {
        if (configData.autoSave === false) {
            autoSaveEnabled = false
        }
    }
    if (configData.rpyFolderPath !== undefined) {
        if (configData.rpyFolderPath !== '') {
            fs.access(configData.rpyFolderPath, fs.constants.F_OK, (err) => {
                if (!err) {
                    // 向主进程发送，切换文件夹
                    mainWin.webContents.send('selectedFolderPath', configData.rpyFolderPath)
                }
            })
        }
    }
}

// 修改配置参数并保存
function updateConfig(newConfigData) {
    const currentConfig = loadConfigFile()
    const updatedConfig = { ...currentConfig, ...newConfigData }
    fs.writeFileSync(appConfigFilePath, JSON.stringify(updatedConfig))
}

// 选择文件夹（复用）
function chooseFolder(winName, purpose, winTitle) {
    dialog.showOpenDialog(winName, {
        title: winTitle,
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled) {
            if (purpose === 'chooseRpyFolder') {
                mainWin.webContents.send('selectedFolderPath', result.filePaths[0])
                // 调用函数记录本次选择的目录，以便下次打开软件时使用
                updateConfig({rpyFolderPath: result.filePaths[0]})
            } else if (purpose === 'chooseOriginalExportFolder') {
                batchWin.webContents.send('batchExportAllScripts', result.filePaths[0])
            } else if (purpose === 'chooseTranslationExportFolder') {
                batchWin.webContents.send('batchExportAllTranslations', result.filePaths[0])
            } else if (purpose === 'chooseTranslationImportFolder') {
                batchWin.webContents.send('batchImportTranslations', result.filePaths[0])
            }
        }
    }).catch(err => {
        console.log(err)
    })
}

// 自动保存函数
function autoSaveFunction() {
    if (autoSaveEnabled === true) {
        // 开启自动保存
        autoSaveInterval = setInterval(() => {
            editWin.webContents.send('autoSave')
        }, 1 * 60 * 1000)   // 每分钟保存一次
        // 修改配置文件
        updateConfig({autoSave: true})
    } else if (autoSaveInterval) {
        // 关闭自动保存
        clearInterval(autoSaveInterval)
        // 并修改配置文件
        updateConfig({autoSave: false})
    }
}

// 响应编辑操作 - 函数
function editRpyFileFun(file) {
    currentFile = file
    const editFilePath = path.join(rpyFolderPath, file)
    createEditWindow()
    editWin.webContents.on('did-finish-load', () => {
        editWin.setTitle(`${file} - 编辑窗口 - ${appGlobalName} (${appGlobalVersion})`)
        editWin.webContents.send('readAndMatchRpyFile', editFilePath)
        autoSaveFunction()
    })
}

// 简单的提示弹窗
function dialogWin(title, content, type) {
    dialog.showMessageBox({
        type: type,     // info, error 等
        title: title,
        message: content,
        buttons: ['确定']
    })
}

// 编辑窗口中，选择需要导入的单个文件
function chooseImportFile() {
    dialog.showOpenDialog(editWin, {
        properties: ['openFile'],
        filters: [{ name: 'TXT 纯文本', extensions: ['txt'] }]
    }).then(result => {
        if (!result.canceled) {
            const filePath = result.filePaths[0]
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error(err)
                    return
                }
                const lines = data.split(/\r?\n/)
                editWin.webContents.send('returnImportFileContent', lines)
            })
        }
    }).catch(err => {
        console.error(err)
    })
}

// 显示问候语~
ipcMain.on('getGreetingTips', (event) => {
    // 获取当前时间
    const currentTime = new Date()
    const hours = currentTime.getHours()
    let greetingTips = '凌晨了 😴'
    if (hours >= 5 && hours < 11) {
        greetingTips = '早上好 🎉'
    } else if (hours >= 11 && hours < 13) {
        greetingTips = '中午好 🍜'
    } else if (hours >= 13 && hours < 18) {
        greetingTips = '下午好 👋'
    } else if (hours >= 18 && hours < 24) {
        greetingTips = '晚上好 😺'
    }
    event.sender.send('receiveGreetingTips', greetingTips)
})

// 渲染进程操作简单的提示弹窗
ipcMain.on('simpleDialogWin', (event, title, content, type) => {
    dialogWin(title, content, type)
})

// 渲染进程获取 .rpy 文件列表
ipcMain.on('getRpyFiles', (event, directoryPath) => {
    rpyFolderPath = directoryPath
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            event.reply('rpyFilesList', { error: err.message });
        } else {
            rpyFilesList = files.filter(file => path.extname(file) === '.rpy');
            event.reply('rpyFilesList', { files: rpyFilesList });
        }
    })
})

// 响应编辑操作
ipcMain.on('openRpyFile', (event, file) => {
    editRpyFileFun(file)
})

// 导出 TSV 的保存窗口
ipcMain.on('chooseTSVExportPath', (event, tsvData) => {
    let csvBuffer = null
    csvBuffer = [`角色代号\t原文\t译文`].concat(tsvData).join('\n')
    dialog.showSaveDialog({
        title: `导出 TSV 表格 - UTF-8`,
        defaultPath: `${currentFile.replace('.rpy','')}_export.tsv`,
        buttonLabel: '保存',
        filters: [{ name: 'TSV 表格', extensions: ['tsv'] }],
    }).then(result => {
        if (!result.canceled) {
            fs.writeFileSync(result.filePath, csvBuffer)
            dialogWin(`导出 TSV 表格 - UTF-8`, `已成功导出至\n${result.filePath}`, 'info')
        }
    }).catch(err => {
        dialogWin(`导出 TSV 表格 - UTF-8`, `导出失败！\n\n${err}`, 'error')
    })
})

// 自动保存后修改 editWin 标题
ipcMain.on('autoSaveChangeEditWinTitle', (event) => {
    const currentTime = new Date().toLocaleTimeString();
    editWin.setTitle(`${currentFile} - 编辑窗口 - ${appGlobalName} (${appGlobalVersion})  [已于 ${currentTime} 自动保存]`)
})

// 询问是否需要保存编辑
ipcMain.on('askAboutSaving', (event) => {
    const choice = dialog.showMessageBoxSync({
        type: 'question',
        buttons: ['取消', '保存', '不保存'],
        defaultId: 1,
        message: '是否需要保存再退出？'
    })
    if (choice === 0) {
        // 取消操作
    } else if (choice === 1) {
        // 保存并退出
        event.sender.send('saveFunction')
    } else {
        // 不保存
        editWin.destroy()
    }
})

// 强行关闭编辑窗口
ipcMain.on('forceCloseWin', (event) => {
    editWin.destroy()
})

// 批量导出时选择保存文件夹
ipcMain.on('chooseExportFolder', (event, content) => {
    if (content === 'Original') {
        chooseFolder(batchWin, 'chooseOriginalExportFolder', '选择保存文件夹')
    } else if (content === 'Translation') {
        chooseFolder(batchWin, 'chooseTranslationExportFolder', '选择保存文件夹')
    }
})

// 选择批量导入翻译的文件夹
ipcMain.on('chooseTranslationImportFolder', (event) => {
    chooseFolder(batchWin, 'chooseTranslationImportFolder', '选择导入文件夹')
})

// 程序启动事件
app.whenReady().then(() => {
    function readyToStart() {
        // 启动后执行的命令都在这里~
        createMainWindow()
        enableConfig(loadConfigFile())
    }
    readyToStart()
    // 适配 macOS 关闭所有窗口后，点击后台程序，执行启动事件的特性
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            readyToStart()
        }
    })
})

// 关于界面
app.setAboutPanelOptions({
    iconPath: appIconPath,
    applicationName: appGlobalName,
    applicationVersion: `${appGlobalVersion}`,
    version: `Electron 版本号: ${process.versions.electron}`,
    credits: appDescription,
    copyright: `Copyright © 2024 Carri Studio`,
    authors: [
      {
        name: "Carri Studio",
        role: "Developer",
        email: "we@carristudio.site",
        website: "https://www.carristudio.com"
      }
    ],
    website: "https://www.carristudio.com",
    description: appDescription,
    license: "GPL-3.0",
    additionalNotes: "感谢使用捏，欢迎来找我们玩儿",
})

// 适配 macOS 关闭所有窗口后，应用仍运行的特性
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})