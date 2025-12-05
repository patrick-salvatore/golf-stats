defmodule GolfStatsServerWeb.ClubControllerTest do
  use GolfStatsServerWeb.ConnCase

  import GolfStatsServer.BagFixtures

  alias GolfStatsServer.Bag.Club

  @create_attrs %{
    name: "some name",
    type: "some type"
  }
  @update_attrs %{
    name: "some updated name",
    type: "some updated type"
  }
  @invalid_attrs %{name: nil, type: nil}

  setup %{conn: conn} do
    {:ok, conn: put_req_header(conn, "accept", "application/json")}
  end

  describe "index" do
    test "lists all clubs", %{conn: conn} do
      conn = get(conn, ~p"/api/clubs")
      assert json_response(conn, 200)["data"] == []
    end
  end

  describe "create club" do
    test "renders club when data is valid", %{conn: conn} do
      conn = post(conn, ~p"/api/clubs", club: @create_attrs)
      assert %{"id" => id} = json_response(conn, 201)["data"]

      conn = get(conn, ~p"/api/clubs/#{id}")

      assert %{
               "id" => ^id,
               "name" => "some name",
               "type" => "some type"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn} do
      conn = post(conn, ~p"/api/clubs", club: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "update club" do
    setup [:create_club]

    test "renders club when data is valid", %{conn: conn, club: %Club{id: id} = club} do
      conn = put(conn, ~p"/api/clubs/#{club}", club: @update_attrs)
      assert %{"id" => ^id} = json_response(conn, 200)["data"]

      conn = get(conn, ~p"/api/clubs/#{id}")

      assert %{
               "id" => ^id,
               "name" => "some updated name",
               "type" => "some updated type"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn, club: club} do
      conn = put(conn, ~p"/api/clubs/#{club}", club: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "delete club" do
    setup [:create_club]

    test "deletes chosen club", %{conn: conn, club: club} do
      conn = delete(conn, ~p"/api/clubs/#{club}")
      assert response(conn, 204)

      assert_error_sent 404, fn ->
        get(conn, ~p"/api/clubs/#{club}")
      end
    end
  end

  defp create_club(_) do
    club = club_fixture()
    %{club: club}
  end
end
