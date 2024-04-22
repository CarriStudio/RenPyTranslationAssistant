# Ren'Py 翻译助手 (Ren'Py Translation Assistant)

一个翻译 Ren'Py 制作的游戏的台词的辅助工具 (An auxiliary tool for translating scripts for games made by Ren'Py.)

Version: **Beta 0.1.3**



### 使用方法

前往 **release** 下载最新版本即可

如需构建其他系统版本（如 **Ubuntu**、**macOS**），请尝试 `npm install` 安装所需依赖；

如果 **electron-builder** 出现问题，请尝试依据 [官方手册](https://www.electron.build/)，使用 **yarn** 安装 **electron-builder**.



### 待完成想法

· 接入 rpatool 或者 unrpa 等工具，以解包 rpa 文件

· 实现半个窗口输入，另一半使用翻译网站或其他工具

· 更丝滑的输入和编辑体验

· 帮助手册的编写工作



### 已实现想法

· 支持选择文件夹，扫描文件夹下的所有 rpy 文件

· 支持基本的打开，对话匹配，修改保存

· 加入 electron-builder 打包构建

· 支持导出 .tsv 表格，和导入翻译文件

· 自动保存功能（每分钟）

