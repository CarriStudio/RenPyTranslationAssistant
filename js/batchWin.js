/**
 * 批量操作 Batch Manipulation Window 脚本
 * 包括数据统计，批量导出等操作
 */

const { ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
let folderPath = null
let folderList = null
let sentenceCount = 0

// 界面操作入口：扫描指定的文件夹
ipcRenderer.on('scanTargetFolder', (event, folderPathContent, folderContentList) => {
    folderPath = folderPathContent
    folderList = folderContentList
    if (readAndMatchRpyFile(folderList)) {
        document.getElementById('file_count').innerText = folderList.length
        document.getElementById('sentence_count').innerText = sentenceCount
    } else {
        ipcRenderer.send('simpleDialogWin', '出错了', `目标文件夹读取出错！\n请稍后再试！`, 'error')
    }
})

// 批量依次导出所有剧本的原文
ipcRenderer.on('batchExportAllScripts', (event, saveFolderPath) => {
    folderList.forEach(fileName => {
        const currentFilePath = path.join(folderPath, fileName)
        let currentScriptsContent = []
        fs.readFile(currentFilePath, 'utf8', (err, fileContent) => {
            if (err) {
                console.error(err)
                event.sender.send('simpleDialogWin', '出错了', `目标文件打开出错！\n${err}`, 'error')
            } else {
                // 解析对话内容的变量和常量
                let contentsLine = fileContent.split('\n')
                const oldNewTargetRegex = /translate\s+(\w+)\s+strings:/i
                const oldLineRegex = /old "(.*?)"/i
                let oldNewFlag = false
                // 对话内容遍历匹配
                for (let i = 0; i < contentsLine.length; i++) {
                    const line = contentsLine[i].trim()
                    if (oldNewFlag) {
                        const oldLineMatches = line.match(oldLineRegex)
                        if (oldLineMatches) {
                            currentScriptsContent.push(oldLineMatches[1])
                        }
                    } else if (line.match(oldNewTargetRegex)) {
                        oldNewFlag = true
                    } else if (line.startsWith('translate ')) {
                        var roleNameMatch = contentsLine[i + 2].match(/# (.*?) "/u)
                        var originalMatch = contentsLine[i + 2].match(/"(.*?)"/u)
                        if (!roleNameMatch) {
                            roleNameMatch = contentsLine[i + 3].match(/# (.*?) "/u)
                            originalMatch = contentsLine[i + 3].match(/"(.*?)"/u)
                        }
                        if (roleNameMatch && roleNameMatch.length >= 2 && originalMatch && originalMatch.length >= 2) {
                            currentScriptsContent.push(originalMatch[1])
                        }
                    }
                }
            }
            // 接下来是保存操作
            const saveFilePath = path.join(saveFolderPath, `${fileName.replace('.rpy','')}.txt`)
            const dataToWrite = currentScriptsContent.join('\n')
            fs.writeFile(saveFilePath, dataToWrite, (err) => {
                if (err) {
                    console.error('文件保存出错: ', err)
                    return
                }
            })
        })
    })
    ipcRenderer.send('simpleDialogWin', '操作完成', `已将当前目录下的所有 .rpy 剧本原文导出至\n${saveFolderPath}`, 'info')
})

// 批量依次导出所有剧本的译文
ipcRenderer.on('batchExportAllTranslations', (event, saveFolderPath) => {
    folderList.forEach(fileName => {
        const currentFilePath = path.join(folderPath, fileName)
        let currentScriptsContent = []
        fs.readFile(currentFilePath, 'utf8', (err, fileContent) => {
            if (err) {
                console.error(err)
                event.sender.send('simpleDialogWin', '出错了', `目标文件打开出错！\n${err}`, 'error')
            } else {
                // 解析对话内容的变量和常量
                let contentsLine = fileContent.split('\n')
                const oldNewTargetRegex = /translate\s+(\w+)\s+strings:/i
                const newLineRegex = /new "(.*?)"/i
                let oldNewFlag = false
                // 对话内容遍历匹配
                for (let i = 0; i < contentsLine.length; i++) {
                    const line = contentsLine[i].trim()
                    if (oldNewFlag) {
                        const newLineMatches = line.match(newLineRegex)
                        if (newLineMatches) {
                            currentScriptsContent.push(newLineMatches[1])
                        }
                    } else if (line.match(oldNewTargetRegex)) {
                        oldNewFlag = true
                    } else if (line.startsWith('translate ')) {
                        var roleNameMatch = contentsLine[i + 2].match(/# (.*?) "/u)
                        var translationMatch = contentsLine[i + 3].match(/"(.*?)"/u)
                        if (!roleNameMatch) {
                            roleNameMatch = contentsLine[i + 3].match(/# (.*?) "/u)
                            translationMatch = contentsLine[i + 5].match(/"(.*?)"/u)
                        }
                        if (roleNameMatch && roleNameMatch.length >= 2 && translationMatch && translationMatch.length >= 2) {
                            currentScriptsContent.push(translationMatch[1])
                        }
                    }
                }
            }
            // 接下来是保存操作
            const saveFilePath = path.join(saveFolderPath, `${fileName.replace('.rpy','')}.txt`)
            const dataToWrite = currentScriptsContent.join('\n')
            fs.writeFile(saveFilePath, dataToWrite, (err) => {
                if (err) {
                    console.error('文件保存出错: ', err)
                    return
                }
            })
        })
    })
    ipcRenderer.send('simpleDialogWin', '操作完成', `已将当前目录下的所有 .rpy 剧本译文导出至\n${saveFolderPath}`, 'info')
})

// 批量依次导入翻译文件
ipcRenderer.on('batchImportTranslations', (event, importFolderPath) => {
    const errorList = []
    fs.readdir(importFolderPath, (err, files) => {
        if (err) {
            console.error(err)
            return
        }
        files.forEach(file => {
            if (path.extname(file) === '.txt') {
                const rpyFile = file.replace('.txt', '.rpy')
                fs.readdir(folderPath, (err, folderFiles) => {
                    if (err) {
                        console.error(err)
                        return
                    }
                    if (folderFiles.includes(rpyFile)) {
                        // 继续执行规则替换的代码
                        const currentImportFile = path.join(importFolderPath, file)
                        const currentRpyFile = path.join(folderPath, rpyFile)
                        importTranslation(currentImportFile, currentRpyFile)
                            .then()
                            .catch(err => {
                                console.error(err)
                                errorList.push(file)
                            })
                    } else {
                        errorList.push(file)
                    }
                    if (files.indexOf(file) === files.length - 1) {
                        if (errorList.length === 0) {
                            ipcRenderer.send('simpleDialogWin', '操作完成', `已成功导入${files.length}个文件`, 'info')
                        } else {
                            ipcRenderer.send('simpleDialogWin', '部分翻译可能已完成导入', `以下文件导入失败\n${errorList}`, 'error')
                        }
                    }
                })
            }
        })
    })
})

// 遍历当前目录下所有的 .rpy 文件内容并进行句子的计数
function readAndMatchRpyFile(targetFolderList) {
    targetFolderList.forEach(fileName => {
        const filePath = path.join(folderPath, fileName)
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8')
            const lines = fileContent.split('\n')
            const oldNewTargetRegex = /translate\s+(\w+)\s+strings:/i
            const oldLineRegex = /old "(.*?)"/i
            let oldNewFlag = false
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()
                if (oldNewFlag) {
                    const oldLineMatches = line.match(oldLineRegex)
                    if (oldLineMatches) {
                        sentenceCount = sentenceCount + 1
                    }
                } else if (line.match(oldNewTargetRegex)) {
                    oldNewFlag = true
                } else if (line.startsWith('translate ')) {
                    sentenceCount = sentenceCount + 1
                }
            }
        } catch (err) {
            console.log('出错了', `目标文件打开出错！\n${err}`, 'error')
        }
    })
    return 1
}

// 单个翻译文件的导入
function importTranslation(currentImportFile, currentRpyFile) {
    return new Promise((resolve, reject) => {
        // 先读取导入文件的内容
        let importTranslationContent = []
        try {
            const data = fs.readFileSync(currentImportFile, 'utf-8')
            importTranslationContent = data.split('\n')
        } catch (err) {
            reject('读取文件时出现错误: ', err)
        }
        // 接着扫描当前 .rpy 文件，获取所有翻译文本对应的行数，并记录
        let currentTranslationLineNumber = []
        fs.readFile(currentRpyFile, 'utf8', (err, fileContent) => {
            let contentsLine = null
            if (err) {
                reject('读取 .rpy 文件时出错: ', err)
            } else {
                // 解析对话内容的变量和常量
                contentsLine = fileContent.split('\n')
                const oldNewTargetRegex = /translate\s+(\w+)\s+strings:/i
                const oldLineRegex = /old "(.*?)"/i
                let oldNewFlag = false
                // 对话内容遍历匹配
                for (let i = 0; i < contentsLine.length; i++) {
                    const line = contentsLine[i].trim()
                    if (oldNewFlag) {
                        const oldLineMatches = line.match(oldLineRegex)
                        if (oldLineMatches) {
                            currentTranslationLineNumber.push(i+1)
                        }
                    } else if (line.match(oldNewTargetRegex)) {
                        oldNewFlag = true
                    } else if (line.startsWith('translate ')) {
                        var targetEditLineNumber = i + 3
                        var roleNameMatch = contentsLine[i + 2].match(/# (.*?) "/u)
                        var originalMatch = contentsLine[i + 2].match(/"(.*?)"/u)
                        if (!roleNameMatch) {
                            targetEditLineNumber = i + 5
                            roleNameMatch = contentsLine[i + 3].match(/# (.*?) "/u)
                            originalMatch = contentsLine[i + 3].match(/"(.*?)"/u)
                        }
                        if (roleNameMatch && roleNameMatch.length >= 2 && originalMatch && originalMatch.length >= 2) {
                            currentTranslationLineNumber.push(targetEditLineNumber)
                        }
                    }
                }
            }
            // 然后是保存操作
            // 开始替换
            for (let i = 0; i < importTranslationContent.length; i++) {
                const targetEditLineNumber = currentTranslationLineNumber[i]
                // 在指定行数进行文本替换
                if (targetEditLineNumber + 1 <= contentsLine.length) {
                    contentsLine[targetEditLineNumber] = contentsLine[targetEditLineNumber].replace(/"(.*?)"/u, `"${importTranslationContent[i]}"`)
                } else {
                    const err = '出错了，文件内容不匹配!'
                    console.error(err)
                    reject(err)
                }
            }
            // 最后保存文件
            const updatedData = contentsLine.join('\n')
            try {
                fs.writeFileSync(currentRpyFile, updatedData, 'utf8')
            } catch (err) {
                reject('保存出错 ',err)
            }
            resolve('导入成功')
        })
    })
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
    // 为按钮添加监听事件
    document.getElementById('batch_export_all_original').addEventListener('click', () => {
        ipcRenderer.send('chooseExportFolder', 'Original')
    })
    document.getElementById('batch_export_all_translations').addEventListener('click', () => {
        ipcRenderer.send('chooseExportFolder', 'Translation')
    })
    document.getElementById('batch_import_all_file').addEventListener('click', () => {
        ipcRenderer.send('chooseTranslationImportFolder')
    })
})