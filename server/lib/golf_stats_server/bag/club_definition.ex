defmodule GolfStatsServer.Bag.ClubDefinition do
  use Ecto.Schema
  import Ecto.Changeset

  schema "club_definitions" do
    field :name, :string
    field :type, :string
    field :category, :string
    field :default_selected, :boolean, default: false
    field :sort_order, :integer

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(club_definition, attrs) do
    club_definition
    |> cast(attrs, [:name, :type, :category, :default_selected, :sort_order])
    |> validate_required([:name, :type, :category])
  end
end
