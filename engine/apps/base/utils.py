import json
import re
from urllib.parse import urlparse

import phonenumbers
from django.apps import apps
from phonenumbers import NumberParseException
from telegram import Bot
from twilio.base.exceptions import TwilioException
from twilio.rest import Client

from common.api_helpers.utils import create_engine_url


class LiveSettingProxy:
    def __dir__(self):
        LiveSetting = apps.get_model("base", "LiveSetting")
        return LiveSetting.AVAILABLE_NAMES

    def __getattr__(self, item):
        LiveSetting = apps.get_model("base", "LiveSetting")

        value = LiveSetting.get_setting(item)
        return value

    def __setattr__(self, key, value):
        LiveSetting = apps.get_model("base", "LiveSetting")
        LiveSetting.objects.update_or_create(name=key, defaults={"value": value})


live_settings = LiveSettingProxy()


class LiveSettingValidator:
    def __init__(self, live_setting):
        self.live_setting = live_setting

    def get_error(self):
        check_fn_name = f"_check_{self.live_setting.name.lower()}"

        if self.live_setting.value is None:
            return "Empty"

        # skip validation if there's no handler for it
        if not hasattr(self, check_fn_name):
            return None

        check_fn = getattr(self, check_fn_name)
        return check_fn(self.live_setting.value)

    @classmethod
    def _check_twilio_account_sid(cls, twilio_account_sid):
        try:
            Client(twilio_account_sid, live_settings.TWILIO_AUTH_TOKEN).api.accounts.list(limit=1)
        except Exception as e:
            return cls._prettify_twilio_error(e)

    @classmethod
    def _check_twilio_auth_token(cls, twilio_auth_token):
        try:
            Client(live_settings.TWILIO_ACCOUNT_SID, twilio_auth_token).api.accounts.list(limit=1)
        except Exception as e:
            return cls._prettify_twilio_error(e)

    @classmethod
    def _check_twilio_verify_service_sid(cls, twilio_verify_service_sid):
        try:
            twilio_client = Client(live_settings.TWILIO_ACCOUNT_SID, live_settings.TWILIO_AUTH_TOKEN)
            twilio_client.verify.services(twilio_verify_service_sid).rate_limits.list(limit=1)
        except Exception as e:
            return cls._prettify_twilio_error(e)

    @classmethod
    def _check_twilio_number(cls, twilio_number):
        if not cls._is_phone_number_valid(twilio_number):
            return "Please specify a valid phone number in the following format: +XXXXXXXXXXX"

    @classmethod
    def _check_slack_install_return_redirect_host(cls, slack_install_return_redirect_host):
        scheme = urlparse(slack_install_return_redirect_host).scheme
        if scheme != "https":
            return "Must use https"

    @classmethod
    def _check_telegram_token(cls, telegram_token):
        try:
            bot = Bot(telegram_token)
            bot.get_me()
        except Exception as e:
            return f"Telegram error: {str(e)}"

    @classmethod
    def _check_telegram_webhook_host(cls, telegram_webhook_host):
        try:
            url = create_engine_url("/telegram/", override_base=telegram_webhook_host)
            bot = Bot(token=live_settings.TELEGRAM_TOKEN)
            bot.set_webhook(url)
        except Exception as e:
            return f"Telegram error: {str(e)}"

    @classmethod
    def _check_grafana_cloud_oncall_token(cls, grafana_oncall_token):
        from apps.oss_installation.models import CloudConnector

        _, err = CloudConnector.sync_with_cloud(grafana_oncall_token)
        return err

    @staticmethod
    def _is_email_valid(email):
        return re.match(r"^[^@]+@[^@]+\.[^@]+$", email)

    @staticmethod
    def _is_phone_number_valid(phone_number):
        try:
            ph_num = phonenumbers.parse(phone_number)
            return phonenumbers.is_valid_number(ph_num)
        except NumberParseException:
            return False

    @staticmethod
    def _prettify_twilio_error(exc):
        if isinstance(exc, TwilioException):
            if len(exc.args) > 1:
                response_content = exc.args[1].content
                content = json.loads(response_content)

                error_code = content["code"]
                more_info = content["more_info"]
                return f"Twilio error: code {error_code}. Learn more: {more_info}"
            else:
                return f"Twilio error: {exc.args[0]}"
        else:
            return f"Twilio error: {str(exc)}"
