defmodule GolfStatsServer.Round do
  use Ecto.Schema
  import Ecto.Changeset

  schema "rounds" do
    field(:date, :date)
    field(:course_name, :string)
    field(:total_score, :integer)
    field(:created_at, :utc_datetime)
    field(:ended_at, :utc_datetime)
    belongs_to(:course, GolfStatsServer.Courses.Course)
    belongs_to(:user, GolfStatsServer.Accounts.User)
    has_many(:holes, GolfStatsServer.Hole)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(round, attrs) do
    round
    |> cast(attrs, [
      :course_name,
      :date,
      :total_score,
      :created_at,
      :ended_at,
      :course_id,
      :user_id
    ])
    |> validate_required([:course_name, :date, :total_score, :user_id])
    |> cast_assoc(:holes, with: &GolfStatsServer.Hole.changeset/2)
  end
end
