/**
 * 编辑界面 Edit Window 脚本
 * 翻译用的编辑窗口
 */

const { ipcRenderer } = require('electron')
const fs = require('fs')
let filePath = null
let scriptsDict = []
let scriptsImportDict = []
let lines = []
let changeFlag = []

// 读取 .rpy 文件内容并生成字典
ipcRenderer.on('readAndMatchRpyFile', (event, targetFilePath) => {
    filePath = targetFilePath
    fs.readFile(filePath, 'utf8', (err, fileContent) => {
        if (err) {
            console.error(err)
            event.sender.send('simpleDialogWin', '出错了', `目标文件打开出错！\n${err}`, 'error')
        } else {
            // 解析对话内容的变量和常量
            lines = fileContent.split('\n')
            const oldNewTargetRegex = /translate\s+(\w+)\s+strings:/i
            const oldLineRegex = /old "(.*?)"/i
            const newLineRegex = /new "(.*?)"/i
            let oldNewFlag = false
            let currentScript = {}
            // 对话内容遍历匹配
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()
                if (oldNewFlag) {
                    // 如果已经找到结尾部分（通常 old & new 在结尾），则匹配 old & new 的规则
                    const oldLineMatches = line.match(oldLineRegex)
                    if (oldLineMatches) {
                        const originalLineContent = oldLineMatches[1]
                        const translationLineContent = lines[i + 1].match(newLineRegex)[1]
                        const locateFlagContent = lines[i - 1].match(/:(\d+)/)[1]
                        currentScript = {
                            targetEditLine: i + 1,
                            locateFlag: locateFlagContent,
                            roleName: '',
                            original: originalLineContent,
                            translation: translationLineContent
                        }
                        scriptsDict.push(currentScript)
                    }
                } else if (line.match(oldNewTargetRegex)) {
                    // 如果没找到，则找一找
                    oldNewFlag = true
                } else if (line.startsWith('translate ')) {
                    // 如果还没找到，那就需要匹配普通行的规则
                    // 以 translate 开头的内容作为定位标
                    var targetEditLineNumber = i + 3
                    var roleNameMatch = lines[i + 2].match(/# (.*?) "/u)
                    var originalMatch = lines[i + 2].match(/"(.*?)"/u)
                    var translationMatch = lines[i + 3].match(/"(.*?)"/u)
                    var locateFlagMatch = lines[i - 1].match(/:(\d+)/)[1]
                    if (!roleNameMatch) {
                        targetEditLineNumber = i + 5
                        roleNameMatch = lines[i + 3].match(/# (.*?) "/u)
                        originalMatch = lines[i + 3].match(/"(.*?)"/u)
                        translationMatch = lines[i + 5].match(/"(.*?)"/u)
                    }
                    if (roleNameMatch && roleNameMatch.length >= 2 && originalMatch && originalMatch.length >= 2 && translationMatch && translationMatch.length >= 2) {
                        currentScript = {
                            targetEditLine: targetEditLineNumber,
                            locateFlag: locateFlagMatch,
                            roleName: roleNameMatch[1],
                            original: originalMatch[1],
                            translation: translationMatch[1]
                        }
                        scriptsDict.push(currentScript)
                    }
                }
            }
        }
    })
    setDelay(300).then(() => {
        // 根据 locateFlag 的大小排列元素，目的是为了将选项显示在正确的位置
        // 同时保持 相同 locateFlag 元素 的原始顺序
        scriptsDict.sort((a, b) => {
            if (a.locateFlag === b.locateFlag) {
                return 0
            } else {
                return a.locateFlag - b.locateFlag
            }
        })
        showDictContent(scriptsDict)
    })
})

// 导入翻译文件
ipcRenderer.on('returnImportFileContent', (event, fileContent) => {
    if (fileContent.length === Object.keys(scriptsDict).length) {
        fileContent.forEach((line, index) => {
            scriptsImportDict[index] = line.trim()
        })
        // 将新列表中的内容更新至页面的翻译框中
        const translationInputs = document.querySelectorAll('.translation_class')
        translationInputs.forEach((textInput, index) => {
            // 检查当前序号是否在 scriptsDict 中
            if (scriptsDict[index]) {
                // 更新 input 框的内容为对应序号的翻译值
                textInput.value = scriptsImportDict[index]
            } else {
                console.log(`找不到序号为 ${index} 的翻译`)
            }
        })
        event.sender.send('simpleDialogWin', '导入成功', '文件导入成功', 'info')
    } else {
        event.sender.send('simpleDialogWin', '出错了', '导入失败，选择的文件与正在编辑的文件的行数不匹配！', 'error')
    }
})

// 导出 TSV 格式文件
ipcRenderer.on('exportTSVSheet', (event, encode) => {
    // 先判断是否做出了更改
    if (isChangedOrNot()) {
        event.sender.send('simpleDialogWin', '提示', '您已修改当前内容，请先保存后再进行导出！', 'info')
        return
    }
    // 提取所需的键值对
    const scriptsDictToExport = Object.values(scriptsDict).map(item => ({
        '角色代号': item.roleName,
        '原文': item.original,
        '译文': item.translation
    }))
    // 将数据转换为 TSV 格式
    const exportTSVData = scriptsDictToExport.map(item => Object.values(item).join(`\t`))
    // 接下来交给主进程去处理~
    event.sender.send('chooseTSVExportPath', exportTSVData, encode)
})

// 保存并判断是否需要关闭窗口
ipcRenderer.on('saveChanges', (event, closeWin) => {
    if (isChangedOrNot()) {
        // 做出了改动
        if (closeWin) {
            event.sender.send('askAboutSaving')
        } else {
            if (saveChanges()) {
                event.sender.send('simpleDialogWin', '提示', '保存成功', 'info')
            }
        }
    } else {
        // 未做出改动
        if (closeWin) {
            event.sender.send('forceCloseWin')
        }
    }
})

// 自动保存调用方法
ipcRenderer.on('autoSave', (event) => {
    if (isChangedOrNot()) {
        if (saveChanges()) {
            event.sender.send('autoSaveChangeEditWinTitle')
        }
    }
})

// 保存并退出
ipcRenderer.on('saveFunction', (event) => {
    // 调用保存函数
    if (saveChanges()) {
        event.sender.send('forceCloseWin')
    }
})

// 全局延时函数（异步）
function setDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// 展示字典中的所有内容（由文心一言 4.0 辅助生成）
function showDictContent(dictContent) {
    var itemCount = 0
    const container = document.getElementById('script-container')
    dictContent.forEach((script, index) => {
        // 创建每个条目的表单元素
        itemCount++
        const form = document.createElement('div')
        form.className = 'script-form'
        const itemCountLabel = document.createElement('label')
        itemCountLabel.className = 'item_count_label'
        itemCountLabel.textContent = itemCount
        form.appendChild(itemCountLabel)
        // 显示这句话在原文中的行数
        // const locateFlagLabel = document.createElement('label')
        // locateFlagLabel.className = 'locate_flag_label'
        // locateFlagLabel.textContent = script.locateFlag
        // form.appendChild(locateFlagLabel)
        const roleNameLabel = document.createElement('label')
        roleNameLabel.className = 'role_name_label'
        roleNameLabel.textContent = '人物'
        form.appendChild(roleNameLabel)
        const roleNameContent = document.createElement('input')
        roleNameContent.type = 'text'
        roleNameContent.className = 'role_name'
        roleNameContent.value = script.roleName
        roleNameContent.readOnly = true
        form.appendChild(roleNameContent);  
        // 同样的方式创建 original 和 translation 的表单元素...
        const originalLabel = document.createElement('label')
        originalLabel.textContent = '原文'
        form.appendChild(originalLabel)
        const originalText = document.createElement('textarea')
        originalText.className = 'original_class'
        originalText.value = script.original
        originalText.readOnly = true
        form.appendChild(originalText)
        // 设置文本框的初始高度
        originalText.style.height = originalText.scrollHeight + 'px'
        // 在文框创建后，再次调整一次高度以确保内容全部显示
        setTimeout(() => {
            originalText.style.height = originalText.scrollHeight + 'px'
        }, 2)
        const translationLabel = document.createElement('label')
        translationLabel.textContent = '译文'
        form.appendChild(translationLabel)
        const translationText = document.createElement('input')
        translationText.type = 'text'
        translationText.className = 'translation_class'
        translationText.value = script.translation
        translationText.spellcheck = false
        form.appendChild(translationText)
        // 将表单添加到容器中
        container.appendChild(form)
    })
}

// 检测是否做出改动 - 函数
function isChangedOrNot() {
    document.querySelectorAll('.translation_class').forEach((element, index) => {
        let translationText = element.value
        if (translationText !== scriptsDict[index].translation) {
            changeFlag[index] = true
        } else {
            changeFlag[index] = false
        }
    })
    if (changeFlag.every(item => item === false)) {
        // 未做出改动
        return 0
    } else {
        // 做出了改动
        return 1
    }
}

// 保存操作（一定做出了改动）
function saveChanges() {
    let fileContent = []
    // 预处理需要修改的文件
    try {
        const data = fs.readFileSync(filePath, 'utf8')
        // 将文件内容拆分为行数组
        fileContent = data.split('\n')
    } catch (err) {
        console.error(`读取文件出错 ${err}`)
        ipcRenderer.send('simpleDialogWin', '出错了', `读取文件时出错！\n${err}`, 'error')
        return 0
    }
    // 开始检查和替换
    for (let i = 0; i < changeFlag.length; i++) {
        if (changeFlag[i]) {
            // 说明该条目已做出修改，需要保存
            const translationContent = document.querySelectorAll('.translation_class')[i].value
            const targetEditLineNumber = scriptsDict[i].targetEditLine
            // 先更新一下读取到的字典，因为当前操作可能只是保存而非保存并退出
            scriptsDict[i].translation = translationContent
            // 在指定行数进行文本替换
            if (targetEditLineNumber + 1 <= fileContent.length) {
                fileContent[targetEditLineNumber] = fileContent[targetEditLineNumber].replace(/"(.*?)"/u, `"${translationContent}"`)
            } else {
                ipcRenderer.send('simpleDialogWin', '出错了', `文件读写出错！\n可能是因为您在其他地方编辑了当前文件`, 'error')
                return 0
            }
        }
    }
    // 最后保存文件
    const updatedData = fileContent.join('\n')
    try {
        fs.writeFileSync(filePath, updatedData, 'utf8')
    } catch (err) {
        ipcRenderer.send('simpleDialogWin', '出错了', `文件保存出错！\n\n${err}`, 'error')
        return 0
    }
    return 1
}

// 启动后的加载内容
window.addEventListener('DOMContentLoaded', () => {
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