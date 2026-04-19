# == Schema Information
#
# Table name: rsvps
#
#  id                          :bigint           not null, primary key
#  click_confirmed_at          :datetime
#  confirmation_token          :string
#  email                       :string           not null
#  ip_address                  :string
#  ref                         :string
#  reply_confirmed_at          :datetime
#  signup_confirmation_sent_at :datetime
#  synced_at                   :datetime
#  user_agent                  :string
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#
# Indexes
#
#  index_rsvps_on_confirmation_token  (confirmation_token) UNIQUE
#
class Rsvp < ApplicationRecord
  has_paper_trail ignore: [ :ip_address, :user_agent ]
  has_secure_token :confirmation_token

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  before_validation :downcase_email
  after_commit :deliver_signup_confirmation, on: :create

  def deliver_signup_confirmation
    return if signup_confirmation_sent_at?

    regenerate_confirmation_token if confirmation_token.blank?
    Rsvp::Mailer.signup_confirmation(self).deliver_later
    update_column(:signup_confirmation_sent_at, Time.current)
  end

  def confirm_click!
    return if click_confirmed_at?

    update_column(:click_confirmed_at, Time.current)
  end

  def confirm_reply!
    return if reply_confirmed_at?

    update_column(:reply_confirmed_at, Time.current)
  end

  private

  def downcase_email
    self.email = email.downcase if email.present?
  end
end
