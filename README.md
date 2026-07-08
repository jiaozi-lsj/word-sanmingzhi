# 雷思静个人作品集

这是一个可直接部署到 GitHub Pages 的静态作品集网站。

## 内容

- 首页：个人照片、姓名、教育背景
- 作品集：单词地牢、单词贪吃蛇
- 实习经历：已预留后续补充位置

## 本地结构

- `index.html`：作品集首页
- `styles.css`：页面样式
- `app.js`：导航高亮交互
- `assets/profile-placeholder.svg`：照片占位图
- `games/word-dungeon/`：单词地牢最终版
- `games/word-snake/`：单词贪吃蛇最终版
- `CNAME`：GitHub Pages 自定义域名配置

## 替换个人照片

把个人照片放到 `assets/profile.jpg`，然后把 `index.html` 中的：

```html
src="./assets/profile-placeholder.svg"
```

改为：

```html
src="./assets/profile.jpg"
```

## 部署

把本文件夹内容推送到 `jiaozi-lsj/0706word-sanmingzhi` 仓库，并在 GitHub Pages 中选择从 `main` 分支根目录发布。
