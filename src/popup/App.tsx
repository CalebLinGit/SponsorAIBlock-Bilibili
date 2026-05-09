import React, { useState, useEffect } from 'react';
import {
  Switch,
  Select,
  PasswordInput,
  Button,
  Stack,
  Group,
  Divider,
  Text,
  List,
  NumberInput,
} from '@mantine/core';
import { Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../hooks/useI18n';
import { DEFAULT_CONFIG } from './config';

interface ConfigForm {
  aiModel: string;
  apiKey: string;
}

const App: React.FC = () => {
  const { t } = useI18n();

  // Basic config state
  const [autoSkip, setAutoSkip] = useState<boolean>(DEFAULT_CONFIG.autoSkip);
  const [ignoreVideoLessThan5Minutes, setIgnoreVideoLessThan5Minutes] = useState<boolean>(
    DEFAULT_CONFIG.ignoreVideoLessThan5Minutes
  );
  // Radar config state
  const [radarEnabled, setRadarEnabled] = useState<boolean>(DEFAULT_CONFIG.radarEnabled);
  const [hardAdAction, setHardAdAction] = useState<string>(DEFAULT_CONFIG.hardAdAction);
  const [integratedAdAction, setIntegratedAdAction] = useState<string>(
    DEFAULT_CONFIG.integratedAdAction
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(
    DEFAULT_CONFIG.confidenceThreshold
  );

  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get([
        'autoSkip',
        'ignoreVideoLessThan5Minutes',
        'radarEnabled',
        'hardAdAction',
        'integratedAdAction',
        'confidenceThreshold',
      ]);

      if (result.autoSkip !== undefined) setAutoSkip(result.autoSkip);
      else await chrome.storage.local.set({ autoSkip: DEFAULT_CONFIG.autoSkip });

      if (result.ignoreVideoLessThan5Minutes !== undefined)
        setIgnoreVideoLessThan5Minutes(result.ignoreVideoLessThan5Minutes);
      else
        await chrome.storage.local.set({
          ignoreVideoLessThan5Minutes: DEFAULT_CONFIG.ignoreVideoLessThan5Minutes,
        });

      if (result.radarEnabled !== undefined) setRadarEnabled(result.radarEnabled);
      else await chrome.storage.local.set({ radarEnabled: DEFAULT_CONFIG.radarEnabled });

      if (result.hardAdAction !== undefined) setHardAdAction(result.hardAdAction);
      else await chrome.storage.local.set({ hardAdAction: DEFAULT_CONFIG.hardAdAction });

      if (result.integratedAdAction !== undefined) setIntegratedAdAction(result.integratedAdAction);
      else
        await chrome.storage.local.set({ integratedAdAction: DEFAULT_CONFIG.integratedAdAction });

      if (result.confidenceThreshold !== undefined)
        setConfidenceThreshold(result.confidenceThreshold);
      else
        await chrome.storage.local.set({
          confidenceThreshold: DEFAULT_CONFIG.confidenceThreshold,
        });
    };

    loadSettings();
  }, []);

  const showSuccessNotification = (message: string) => {
    notifications.show({
      title: t('saved'),
      message,
      color: 'green',
      position: 'top-right',
    });
  };

  const showFailedNotification = (message: string) => {
    notifications.show({
      title: t('error'),
      message,
      color: 'red',
      position: 'top-right',
    });
  };

  const updateAutoSkip = async (value: boolean) => {
    setAutoSkip(value);
    await chrome.storage.local.set({ autoSkip: value });
    showSuccessNotification(t('refreshToApply'));
  };

  const updateIgnoreVideoLessThan5Minutes = async (value: boolean) => {
    setIgnoreVideoLessThan5Minutes(value);
    await chrome.storage.local.set({ ignoreVideoLessThan5Minutes: value });
    showSuccessNotification(t('refreshToApply'));
  };

  const updateRadarEnabled = async (value: boolean) => {
    setRadarEnabled(value);
    await chrome.storage.local.set({ radarEnabled: value });
    showSuccessNotification(t('refreshToApply'));
  };

  const updateHardAdAction = async (value: string | null) => {
    if (!value) return;
    setHardAdAction(value);
    await chrome.storage.local.set({ hardAdAction: value });
    showSuccessNotification(t('refreshToApply'));
  };

  const updateIntegratedAdAction = async (value: string | null) => {
    if (!value) return;
    setIntegratedAdAction(value);
    await chrome.storage.local.set({ integratedAdAction: value });
    showSuccessNotification(t('refreshToApply'));
  };

  const updateConfidenceThreshold = async (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return;
    setConfidenceThreshold(num);
    await chrome.storage.local.set({ confidenceThreshold: num });
    showSuccessNotification(t('refreshToApply'));
  };

  const form = useForm<ConfigForm>({
    mode: 'uncontrolled',
    initialValues: {
      aiModel: DEFAULT_CONFIG.aiModel,
      apiKey: DEFAULT_CONFIG.apiKey,
    },
  });

  useEffect(() => {
    const loadFormData = async () => {
      const result = await chrome.storage.local.get(['aiModel', 'apiKey']);
      form.setValues({
        aiModel: result.aiModel || DEFAULT_CONFIG.aiModel,
        apiKey: result.apiKey || DEFAULT_CONFIG.apiKey,
      });
      form.resetDirty();
    };
    loadFormData();
  }, []);

  const handleSubmit = async (values: ConfigForm) => {
    await chrome.storage.local.set({
      aiModel: values.aiModel,
      apiKey: values.apiKey,
    });
    form.resetDirty();
    showSuccessNotification(t('refreshToApply'));
  };

  const switchStyles = {
    body: { justifyContent: 'space-between' },
    trackLabel: { width: '100%' },
    label: { fontSize: '13px' },
  };

  return (
    <Tabs defaultValue="config" styles={{ tabLabel: { fontSize: '13px' } }}>
      <Tabs.List>
        <Tabs.Tab value="config">{t('configTab')}</Tabs.Tab>
        <Tabs.Tab value="instructions">{t('instructionsTab')}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="config">
        <div style={{ padding: '18px', color: 'inherit' }}>
          <Stack gap="sm">
            <Divider size="xs" label={t('basicConfig')} labelPosition="center" />
            <Switch
              label={t('autoSkipAds')}
              labelPosition="left"
              size="sm"
              styles={switchStyles}
              checked={autoSkip}
              onChange={(e) => updateAutoSkip(e.currentTarget.checked)}
            />
            <Switch
              label={t('ignoreVideoLessThan5Minutes')}
              labelPosition="left"
              size="sm"
              styles={switchStyles}
              checked={ignoreVideoLessThan5Minutes}
              onChange={(e) => updateIgnoreVideoLessThan5Minutes(e.currentTarget.checked)}
            />
          </Stack>

          <form onSubmit={form.onSubmit(handleSubmit)} onReset={form.onReset}>
            <Stack gap="sm">
              <div>
                <Divider
                  my="xs"
                  label={t('aiConfig')}
                  labelPosition="center"
                  styles={{ root: { marginBlock: 0, marginBottom: '0px' } }}
                />
                <Select
                  {...form.getInputProps('aiModel')}
                  key={form.key('aiModel')}
                  label={t('aiModel')}
                  placeholder="Pick value"
                  maxDropdownHeight={100}
                  searchable
                  size="xs"
                  data={[
                    {
                      group: 'Gemini',
                      items: [
                        { value: 'gemini-3.0-flash', label: 'gemini-3.0-flash' },
                        { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
                        { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
                      ],
                    },
                  ]}
                />
                <PasswordInput
                  label={t('apiKey')}
                  placeholder={t('enterApiKey')}
                  {...form.getInputProps('apiKey')}
                  size="xs"
                />
              </div>
              <Group justify="flex-end" mt="sm" gap="xs">
                <Button type="submit" size="xs" disabled={!form.isDirty()}>
                  {t('save')}
                </Button>
              </Group>
            </Stack>
          </form>

          <Stack gap="sm" mt="xs">
            <Divider size="xs" label="雷达检测" labelPosition="center" />
            <Switch
              label="启用雷达预检测"
              labelPosition="left"
              size="sm"
              styles={switchStyles}
              checked={radarEnabled}
              onChange={(e) => updateRadarEnabled(e.currentTarget.checked)}
            />
            <Select
              label="硬广处理方式"
              size="xs"
              value={hardAdAction}
              onChange={updateHardAdAction}
              data={[
                { value: 'auto_skip', label: '自动跳过' },
                { value: 'prompt', label: '提示用户' },
              ]}
            />
            <Select
              label="深度植入广告处理方式"
              size="xs"
              value={integratedAdAction}
              onChange={updateIntegratedAdAction}
              data={[
                { value: 'auto_skip', label: '自动跳过' },
                { value: 'prompt', label: '提示用户' },
                { value: 'ignore', label: '忽略' },
              ]}
            />
            <NumberInput
              label="置信度阈值"
              size="xs"
              value={confidenceThreshold}
              onChange={updateConfidenceThreshold}
              min={0}
              max={1}
              step={0.1}
              decimalScale={1}
            />
          </Stack>
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="instructions">
        <div style={{ padding: '18px' }}>
          <Text size="sm" fw={600}>
            {t('howToUse')}
          </Text>
          <List size="sm">
            <List.Item>
              <a href="https://github.com/hh54188/bilibili-ad-killer" target="_blank">
                English Version
              </a>
            </List.Item>
            <List.Item>
              <a href="https://www.v2think.com/ad-killer" target="_blank">
                中文教程
              </a>
            </List.Item>
          </List>
        </div>
        <div style={{ padding: '18px' }}>
          <Text size="sm" fw={600}>
            {t('sourceCode')}
          </Text>
          <List size="sm">
            <List.Item>
              <a href="https://github.com/hh54188/bilibili-ad-killer" target="_blank">
                GitHub
              </a>
            </List.Item>
          </List>
        </div>
      </Tabs.Panel>
    </Tabs>
  );
};

export default App;
