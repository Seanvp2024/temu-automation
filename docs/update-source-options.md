# 更新源部署方案

这份文档给你三种可用的更新源方案：

- 内网共享目录
- 云盘直链
- 静态站点

客户端统一要求：

- 更新源地址必须是一个 `http(s)` 目录
- 目录内至少包含：
  - `latest.yml`
  - `Temu 自动化运营工具-Setup-<version>.exe`
  - `Temu 自动化运营工具-Setup-<version>.exe.blockmap`

也就是说，无论你选哪种方案，最终都要把 [release](C:/Users/Administrator/temu-automation/release) 里的这三类文件稳定提供给客户端访问。

---

## 方案一：内网共享更新源

### 适用场景

- 公司内部电脑使用
- 不希望把安装包放到公网
- 有固定办公网络或 VPN

### 推荐实现

最稳的是：

1. 准备一台内网 Windows 机器或内网服务器
2. 用 IIS、Nginx 或任意静态文件服务把一个目录发布成 HTTP 地址
3. 把 `release` 目录中的发布文件上传到这个目录

例如更新地址可以是：

- `http://192.168.1.20/temu-updates/`
- `http://intranet/temu-updates/`

客户端就在 `设置 -> 应用更新` 里填写这个地址。

### 优点

- 速度快
- 成本低
- 适合内部办公环境

### 缺点

- 出外网或换网络后通常不可用
- 需要一台长期在线的内网主机

### 注意

- 不建议直接填 Windows 文件共享路径，比如 `\\server\share`
- 当前客户端更新逻辑走的是 `http(s)`，不是 SMB 文件共享

---

## 方案二：云盘直链更新源

### 适用场景

- 团队人数不多
- 想快速开始
- 没有专门服务器

### 推荐实现

把发布文件上传到支持“公开直链下载”的云盘或对象存储外链目录，例如：

- 阿里云盘企业空间直链
- 腾讯微云企业版外链
- 对象存储的公开目录链接

然后保证以下三个文件能通过浏览器直接访问：

- `latest.yml`
- 安装包 `.exe`
- `.blockmap`

例如：

- `https://download.example.com/temu/latest.yml`
- `https://download.example.com/temu/Temu 自动化运营工具-Setup-0.1.1.exe`

客户端填写的更新源地址应是目录：

- `https://download.example.com/temu/`

### 优点

- 上手快
- 不需要自己维护服务器
- 适合小团队试运行

### 缺点

- 很多云盘“分享链接”不是直链，客户端会失败
- 有些平台会限速、过期、要求登录或验证码

### 注意

- 只有“稳定直链”才适合自动更新
- 普通分享页、带跳转页、需要手动点下载的链接都不适合

---

## 方案三：静态站点更新源

### 适用场景

- 想做正式分发
- 需要公网访问
- 希望后面稳定维护版本发布

### 推荐实现

把更新文件放到静态站点目录，例如：

- Nginx 静态目录
- OSS / COS / S3 + CDN
- GitHub Releases 外加静态代理目录
- Cloudflare R2 / Pages 静态资源目录

建议目录结构：

```text
https://download.example.com/temu-desktop/
  latest.yml
  Temu 自动化运营工具-Setup-0.1.1.exe
  Temu 自动化运营工具-Setup-0.1.1.exe.blockmap
```

客户端配置：

- `https://download.example.com/temu-desktop/`

### 优点

- 最稳定
- 最适合长期维护
- 便于接 CDN、权限和版本发布流程

### 缺点

- 初次配置稍复杂
- 需要域名或静态托管服务

### 注意

- 这是我最推荐的正式方案
- 如果你后面要做“给多个人持续发版”，优先走这个

---

## 我建议你怎么选

### 先试运行

选：

- 云盘直链更新源

前提是你能确认它真的是直链，不会跳登录页或广告页。

### 公司内部长期用

选：

- 内网共享更新源

成本最低，维护简单。

### 要当正式产品发

选：

- 静态站点更新源

这是最稳的。

---

## 发布动作模板

每次发新版都按这个顺序：

1. 修改 [package.json](C:/Users/Administrator/temu-automation/package.json) 里的版本号
2. 执行 `npm run dist:win`
3. 上传这些文件到更新目录：
   - `latest.yml`
   - `Temu 自动化运营工具-Setup-<version>.exe`
   - `Temu 自动化运营工具-Setup-<version>.exe.blockmap`
4. 在测试机里打开客户端
5. 到 `设置 -> 应用更新`
6. 点 `检查更新`

---

## 不推荐的做法

- 直接发一个新的安装包让所有人手动覆盖，但不配更新源
- 用需要登录的网盘分享页当更新地址
- 用本地磁盘路径或 SMB 路径直接当更新源
- 版本号不变就重复上传同名文件

这些做法短期能混过去，但后面维护一定会乱。
