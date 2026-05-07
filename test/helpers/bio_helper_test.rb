require "test_helper"

class BioHelperTest < ActionView::TestCase
  include BioHelper
  include Rails.application.routes.url_helpers

  setup do
    @alice = User.create!(slack_id: "U_ALICE", display_name: "alice", email: "alice@example.test")
  end

  test "renders empty string for blank bio" do
    assert_equal "", render_bio("")
    assert_equal "", render_bio(nil)
  end

  test "auto-links URLs" do
    out = render_bio("see https://example.com for details")
    assert_includes out, %(<a class="bio-link")
    assert_includes out, "https://example.com"
    assert_includes out, %(target="_blank")
  end

  test "resolves <@id> token to a user link" do
    out = render_bio("hello <@#{@alice.id}>")
    assert_includes out, %(@alice)
    assert_includes out, %(class="bio-mention bio-mention--user")
    assert_includes out, user_path(@alice)
  end

  test "leaves unresolvable token as escaped text" do
    out = render_bio("hi <@99999999>")
    assert_includes out, "&lt;@99999999&gt;"
  end

  test "preserves newlines as <br>" do
    out = render_bio("line1\nline2")
    assert_includes out, "<br>"
  end

  test "escapes HTML in plain text" do
    out = render_bio("<script>alert(1)</script>")
    assert_not_includes out, "<script>"
    assert_includes out, "&lt;script&gt;"
  end
end
