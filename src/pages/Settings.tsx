import { Card, Form, InputNumber, Switch, Button, message } from "antd";

export default function Settings() {
  const [form] = Form.useForm();

  const handleSave = () => {
    const _values = form.getFieldsValue();
    // TODO: 保存到 Tauri 后端
    message.success("设置已保存");
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          operationDelay: 1500,
          maxRetries: 3,
          headless: false,
          autoLoginRetry: true,
          lowStockThreshold: 10,
          screenshotOnError: true,
        }}
      >
        <Card title="浏览器设置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="operationDelay"
            label="操作间隔（毫秒）"
            help="每次操作之间的随机等待时间基准值，越大越安全但越慢"
          >
            <InputNumber min={500} max={10000} step={100} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="maxRetries"
            label="最大重试次数"
            help="操作失败后的重试次数"
          >
            <InputNumber min={1} max={10} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="headless"
            label="无头模式"
            valuePropName="checked"
            help="开启后浏览器在后台运行，不显示窗口"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="screenshotOnError"
            label="错误截图"
            valuePropName="checked"
            help="操作出错时自动截图保存，便于排查问题"
          >
            <Switch />
          </Form.Item>
        </Card>

        <Card title="账号设置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="autoLoginRetry"
            label="自动重新登录"
            valuePropName="checked"
            help="登录态过期时自动重新登录"
          >
            <Switch />
          </Form.Item>
        </Card>

        <Card title="告警设置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="lowStockThreshold"
            label="低库存阈值"
            help="库存低于此数量时触发告警"
          >
            <InputNumber min={1} max={1000} style={{ width: "100%" }} />
          </Form.Item>
        </Card>

        <Button type="primary" onClick={handleSave}>
          保存设置
        </Button>
      </Form>
    </div>
  );
}
