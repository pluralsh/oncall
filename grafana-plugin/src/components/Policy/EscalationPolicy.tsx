import React, { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Input, Select, IconButton } from '@grafana/ui';
import cn from 'classnames/bind';
import moment from 'moment-timezone';
import { SortableElement } from 'react-sortable-hoc';
import reactStringReplace from 'react-string-replace';

import PluginLink from 'components/PluginLink/PluginLink';
import TimeRange from 'components/TimeRange/TimeRange';
import Timeline from 'components/Timeline/Timeline';
import GSelect from 'containers/GSelect/GSelect';
import UserTooltip from 'containers/UserTooltip/UserTooltip';
import { WithPermissionControl } from 'containers/WithPermissionControl/WithPermissionControl';
import { prepareEscalationPolicy } from 'models/escalation_policy/escalation_policy.helpers';
import {
  EscalationPolicy as EscalationPolicyType,
  EscalationPolicyOption,
} from 'models/escalation_policy/escalation_policy.types';
import { WaitDelay } from 'models/wait_delay';
import { SelectOption } from 'state/types';
import { UserAction } from 'state/userAction';

import DragHandle from './DragHandle';
import PolicyNote from './PolicyNote';

import styles from './EscalationPolicy.module.css';

const cx = cn.bind(styles);

export interface EscalationPolicyProps {
  data: EscalationPolicyType;
  waitDelays?: any[];
  numMinutesInWindowOptions: SelectOption[];
  channels?: any[];
  onChange: (id: EscalationPolicyType['id'], value: Partial<EscalationPolicyType>) => void;
  onDelete: (data: EscalationPolicyType) => void;
  escalationChoices: any[];
  number: number;
  color: string;
  isSlackInstalled: boolean;
}

export class EscalationPolicy extends React.Component<EscalationPolicyProps, any> {
  render() {
    const { data, escalationChoices, number, color } = this.props;
    const { id, step, is_final } = data;

    const escalationOption = escalationChoices.find(
      (escalationOption: EscalationPolicyOption) => escalationOption.value === step
    );

    return (
      <Timeline.Item key={id} contentClassName={cx('root')} number={number} color={color}>
        <WithPermissionControl disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
          <DragHandle />
        </WithPermissionControl>
        {escalationOption &&
          reactStringReplace(escalationOption.display_name, /\{\{([^}]+)\}\}/g, this.replacePlaceholder)}
        {this._renderNote()}
        {is_final ? null : (
          <WithPermissionControl className={cx('delete')} userAction={UserAction.UpdateEscalationPolicies}>
            <IconButton
              name="trash-alt"
              className={cx('delete', 'control')}
              onClick={this._handleDelete}
              size="sm"
              tooltip="Delete"
              tooltipPlacement="top"
            />
          </WithPermissionControl>
        )}
      </Timeline.Item>
    );
  }

  replacePlaceholder = (match: string) => {
    switch (match) {
      case 'importance':
        return this.renderImportance();
      case 'timerange':
        return this.renderTimeRange();
      case 'users':
        return this._renderNotifyToUsersQueue();
      case 'wait_delay':
        return this._renderWaitDelays();
      case 'slack_user_group':
        return this._renderNotifyUserGroup();
      case 'schedule':
        return this._renderNotifySchedule();
      case 'custom_action':
        return this._renderTriggerCustomAction();
      case 'num_alerts_in_window':
        return this.renderNumAlertsInWindow();
      case 'num_minutes_in_window':
        return this.renderNumMinutesInWindowOptions();
      default:
        console.warn('Unknown escalation step placeholder');
        return '';
    }
  };

  _renderNote() {
    const { data, isSlackInstalled, escalationChoices } = this.props;
    const { step } = data;

    const option = escalationChoices.find((option) => option.value === step);

    if (!isSlackInstalled && option?.slack_integration_required) {
      return (
        <PolicyNote type="danger">
          Slack Integration required{' '}
          <PluginLink query={{ page: 'chat-ops' }}>
            <Button size="sm" fill="text">
              Install
            </Button>
          </PluginLink>
        </PolicyNote>
      );
    }

    switch (step) {
      case 13:
        return <PolicyNote>{`Your timezone is ${moment.tz.guess()}`}</PolicyNote>;

      default:
        return null;
    }
  }

  private _renderNotifyToUsersQueue() {
    const { data } = this.props;
    const { notify_to_users_queue } = data;

    return (
      <WithPermissionControl key="users-multiple" disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
        <GSelect
          isMulti
          showSearch
          allowClear
          modelName="userStore"
          displayField="username"
          valueField="pk"
          placeholder="Select Users"
          className={cx('select', 'control', 'multiSelect')}
          value={notify_to_users_queue}
          onChange={this._getOnChangeHandler('notify_to_users_queue')}
          getOptionLabel={({ value }: SelectableValue) => <UserTooltip id={value} />}
        />
      </WithPermissionControl>
    );
  }

  private renderImportance() {
    const { data } = this.props;
    const { important } = data;

    return (
      <WithPermissionControl key="importance" disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
        <Select
          menuShouldPortal
          className={cx('select', 'control')}
          value={Number(important)}
          // @ts-ignore
          onChange={this._getOnSelectChangeHandler('important')}
          options={[
            { value: 0, label: 'Default', description: 'Manage "Default notifications" in personal settings' },
            { value: 1, label: 'Important', description: 'Manage "Important notifications" in personal settings' },
          ]}
        />
      </WithPermissionControl>
    );
  }

  private renderTimeRange() {
    const { data } = this.props;

    return (
      <WithPermissionControl key="time-range" disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
        <TimeRange
          from={data.from_time}
          to={data.to_time}
          onChange={this._getOnTimeRangeChangeHandler()}
          className={cx('select', 'control')}
        />
      </WithPermissionControl>
    );
  }

  private _renderWaitDelays() {
    const { data, waitDelays = [] } = this.props;
    const { wait_delay } = data;

    return (
      <WithPermissionControl key="wait-delay" disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
        <Select
          menuShouldPortal
          placeholder="Select Wait Delay"
          className={cx('select', 'control')}
          // @ts-ignore
          value={wait_delay}
          onChange={this._getOnSelectChangeHandler('wait_delay')}
          options={waitDelays.map((waitDelay: WaitDelay) => ({
            value: waitDelay.value,
            label: waitDelay.display_name,
          }))}
        />
      </WithPermissionControl>
    );
  }

  private renderNumAlertsInWindow() {
    const { data } = this.props;
    const { num_alerts_in_window } = data;

    return (
      <WithPermissionControl
        key="num_alerts_in_window"
        disableByPaywall
        userAction={UserAction.UpdateEscalationPolicies}
      >
        <Input
          placeholder="Count"
          className={cx('control')}
          value={num_alerts_in_window}
          onChange={this._getOnInputChangeHandler('num_alerts_in_window')}
          ref={(node) => {
            if (node) {
              node.setAttribute('type', 'number');
              node.setAttribute('min', '1');
            }
          }}
        />
      </WithPermissionControl>
    );
  }

  private renderNumMinutesInWindowOptions() {
    const { data, numMinutesInWindowOptions = [] } = this.props;
    const { num_minutes_in_window } = data;

    return (
      <WithPermissionControl
        key="num_minutes_in_window"
        disableByPaywall
        userAction={UserAction.UpdateEscalationPolicies}
      >
        <Select
          menuShouldPortal
          placeholder="Period"
          className={cx('select', 'control')}
          // @ts-ignore
          value={num_minutes_in_window}
          onChange={this._getOnSelectChangeHandler('num_minutes_in_window')}
          options={numMinutesInWindowOptions.map((waitDelay: SelectOption) => ({
            value: waitDelay.value,
            label: waitDelay.display_name,
          }))}
        />
      </WithPermissionControl>
    );
  }

  private _renderNotifySchedule() {
    const { data } = this.props;
    const { notify_schedule } = data;

    return (
      <WithPermissionControl key="notify_schedule" disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
        <GSelect
          modelName="scheduleStore"
          displayField="name"
          valueField="id"
          placeholder="Select Schedule"
          className={cx('select', 'control')}
          value={notify_schedule}
          onChange={this._getOnChangeHandler('notify_schedule')}
          fromOrganization
        />
      </WithPermissionControl>
    );
  }

  private _renderNotifyUserGroup() {
    const { data } = this.props;
    const { notify_to_group } = data;

    return (
      <WithPermissionControl key="notify_to_group" disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
        <GSelect
          modelName="userGroupStore"
          displayField="name"
          valueField="id"
          placeholder="Select User Group"
          className={cx('select', 'control')}
          value={notify_to_group}
          onChange={this._getOnChangeHandler('notify_to_group')}
        />
      </WithPermissionControl>
    );
  }

  private _renderTriggerCustomAction() {
    const { data } = this.props;
    const { custom_button_trigger } = data;

    return (
      <WithPermissionControl key="custom-button" disableByPaywall userAction={UserAction.UpdateEscalationPolicies}>
        <GSelect
          modelName="outgoingWebhookStore"
          displayField="name"
          valueField="id"
          placeholder="Select Webhook"
          className={cx('select', 'control')}
          value={custom_button_trigger}
          onChange={this._getOnChangeHandler('custom_button_trigger')}
          fromOrganization
        />
      </WithPermissionControl>
    );
  }

  _getOnSelectChangeHandler = (field: string) => {
    return (option: SelectableValue) => {
      const { data, onChange = () => {} } = this.props;
      const { id } = data;

      const newData: Partial<EscalationPolicyType> = {
        ...prepareEscalationPolicy(data),
        [field]: option.value,
      };

      onChange(id, newData);
    };
  };

  _getOnInputChangeHandler = (field: string) => {
    const { data, onChange = () => {} } = this.props;
    const { id } = data;

    return (e: ChangeEvent<HTMLInputElement>) => {
      const newData: Partial<EscalationPolicyType> = {
        ...prepareEscalationPolicy(data),
        [field]: e.currentTarget.value,
      };

      onChange(id, newData);
    };
  };

  _getOnChangeHandler = (field: string) => {
    return (value: any) => {
      const { data, onChange = () => {} } = this.props;
      const { id } = data;

      const newData: Partial<EscalationPolicyType> = {
        ...prepareEscalationPolicy(data),
        [field]: value,
      };

      onChange(id, newData);
    };
  };

  _getOnTimeRangeChangeHandler() {
    return (value: string[]) => {
      const { data, onChange = () => {} } = this.props;
      const { id } = data;

      const newData: Partial<EscalationPolicyType> = {
        ...prepareEscalationPolicy(data),
        from_time: value[0],
        to_time: value[1],
      };

      onChange(id, newData);
    };
  }

  _handleDelete = () => {
    const { onDelete, data } = this.props;

    onDelete(data);
  };
}

export default SortableElement(EscalationPolicy);
