defmodule GolfStatsServerWeb.ClubDefinitionJSON do
  alias GolfStatsServer.Bag.ClubDefinition

  def index(%{club_definitions: club_definitions}) do
    %{data: for(club_definition <- club_definitions, do: data(club_definition))}
  end

  def data(%ClubDefinition{} = club_definition) do
    %{
      id: club_definition.id,
      name: club_definition.name,
      type: club_definition.type,
      category: club_definition.category,
      default_selected: club_definition.default_selected
    }
  end
end
