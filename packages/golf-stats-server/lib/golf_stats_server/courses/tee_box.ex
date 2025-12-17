defmodule GolfStatsServer.Courses.TeeBox do
  use Ecto.Schema
  import Ecto.Changeset

  schema "tee_boxes" do
    field(:name, :string)
    field(:color, :string)
    field(:yardage, :integer)
    field(:lat, :float)
    field(:lng, :float)
    belongs_to(:hole_definition, GolfStatsServer.Courses.HoleDefinition)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(tee_box, attrs) do
    tee_box
    |> cast(attrs, [:name, :color, :yardage, :lat, :lng, :hole_definition_id])
    |> validate_required([:name, :color, :yardage])
  end
end
