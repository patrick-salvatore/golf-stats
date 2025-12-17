defmodule GolfStatsServer.Courses.Course do
  use Ecto.Schema
  import Ecto.Changeset

  schema "courses" do
    field(:name, :string)
    field(:state, :string)
    field(:city, :string)
    field(:lat, :float)
    field(:lng, :float)
    field(:status, :string, default: "draft")
    has_many(:hole_definitions, GolfStatsServer.Courses.HoleDefinition)
    belongs_to(:user, GolfStatsServer.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(course, attrs) do
    course
    |> cast(attrs, [:name, :city, :state, :lat, :lng, :status, :user_id])
    |> validate_required([:name])
    |> validate_inclusion(:status, ["draft", "published"])
    |> cast_assoc(:hole_definitions, with: &GolfStatsServer.Courses.HoleDefinition.changeset/2)
  end
end
