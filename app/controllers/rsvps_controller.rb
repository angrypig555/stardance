class RsvpsController < ApplicationController
  def create
    Rsvp.find_or_create_by!(email: params[:rsvp][:email].to_s.downcase.strip) do |r|
      r.ref        = params[:ref].presence || cookies[:referral_code]
      r.user_agent = request.user_agent
      r.ip_address = request.headers["CF-Connecting-IP"] || request.remote_ip
    end
    redirect_to root_path, notice: "Thanks! We'll email you when we're ready for liftoff"
  rescue ActiveRecord::RecordInvalid
    redirect_to root_path, alert: "Please enter a valid email address."
  end

  def confirm
    Rsvp.find_by(confirmation_token: params[:token])&.confirm_click!
    redirect_to root_path, notice: "You're in! Reply to the email so we don't end up in spam <3"
  end
end
