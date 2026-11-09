# TERROWA 部署步骤

## 一、上传 GitHub

1. 在 GitHub 新建公开仓库，建议仓库名 `terrowa`。
2. 不要额外创建 README、License 或 `.gitignore`。
3. 解压 `TERROWA-GITHUB-UPLOAD.zip`。
4. 把解压后的全部内容上传到仓库根目录并提交。

## 二、在 Remix 部署合约

1. 打开 Remix，并确认 MetaMask 已切换到 BOT Chain。
2. 在 `contracts` 目录中新建 `Terrowa.sol`。
3. 复制 `contracts/src/Terrowa.sol` 的全部内容。
4. 使用 Solidity `0.8.24` 编译；构造函数没有参数。
5. 打开 **Deploy & Run Transactions**。
6. Environment 选择 **Browser Extension / MetaMask**，再次确认网络为 BOT Chain。
7. 点击 Deploy，并在钱包确认交易。
8. 部署完成后复制完整合约地址。

BOT Chain 参数：

```text
Network Name: BOT Chain
Chain ID: 677
Currency Symbol: BOT
RPC URL: https://rpc.botchain.ai
Block Explorer: https://scan.botchain.ai
```

## 三、先加入少量储备金

新合约没有资金时不能承保。可以先用以下任意一种方式加入少量 BOT：

- 调用 `stake`：在 Remix 的 Value 输入少量 BOT，再点击 `stake`；这笔质押有 7 天解锁期。
- 调用 `fundReserve`：在 Value 输入少量 BOT，再点击 `fundReserve`；这是直接储备金，不生成质押份额。

先用小额测试。合约未经专业安全审计。

## 四、部署 Vercel

1. 在 Vercel 选择 **Add New → Project**，导入 GitHub 的 `terrowa` 仓库。
2. Project Name 必须使用小写，例如 `terrowa-app`。
3. Framework Preset 选择 **Vite**。
4. Root Directory 选择 `frontend`。
5. 展开 Environment Variables，添加：

```text
Key: VITE_TERROWA_ADDRESS
Value: 0x你的完整合约地址
Environment: Production
Type: Config
```

合约地址是公开信息，不要设置成 Secret。绝对不要上传钱包私钥或助记词。

6. 点击 Deploy。
7. 如果先部署网页后添加环境变量，请进入 Deployments，选择当前 Production 部署并点 Redeploy。
8. Redeploy 时不要勾选旧 Build Cache。

## 五、网页交互顺序

1. 打开网页，点击 **Connect wallet**。
2. 从钱包选择器中选 MetaMask 或其他已安装钱包；手机可点 **Open a mobile wallet**。
3. 钱包会切换或添加 BOT Chain。
4. 先在 **Pool** 中加入少量质押，或由合约所有者在 Remix 调用 `fundReserve`。
5. 在 **Cover** 中填写保障类型、作物、地区、申报价值和 30–365 天期限。
6. 检查网页显示的保费、最高赔付和可用储备后，点击 **Buy crop cover**。
7. 在 **Claims** 中填写 Policy ID、申请金额、损失说明和 IPFS CID，点击 **File a claim**。
8. 所有者或 assessor 使用 **Assessor review** 审批；批准后合约在偿付能力检查通过时付款。
9. 合约所有者可在 **Weather** 中写入灾害类型、地区和 1–100 严重程度。

## 六、常见问题

- **网页显示 Preview mode**：Vercel 没有读取 `VITE_TERROWA_ADDRESS`，或修改变量后没有重新部署。
- **点击钱包没有扩展选项**：浏览器没有注入钱包；使用移动钱包入口，或在安装钱包扩展的浏览器打开。
- **Contract code was not found**：环境变量地址错误，或钱包/网页连接的不是 BOT Chain。
- **Insufficient liquidity**：可用储备不足以支持新的最高赔付、理赔付款或质押提现。
- **Locked**：质押的 7 天解锁期还没有结束。
- **The wallet request is already open**：钱包里已有待处理请求，先完成或取消它。

