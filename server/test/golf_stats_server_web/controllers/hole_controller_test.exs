defmodule GolfStatsServerWeb.HoleControllerTest do
  use GolfStatsServerWeb.ConnCase

  import GolfStatsServer.StatsFixtures

  alias GolfStatsServer.Stats.Hole

  @create_attrs %{
    hole_number: 42,
    par: 42,
    score: 42,
    fairway_hit: true,
    gir: true,
    putts: 42
  }
  @update_attrs %{
    hole_number: 43,
    par: 43,
    score: 43,
    fairway_hit: false,
    gir: false,
    putts: 43
  }
  @invalid_attrs %{hole_number: nil, par: nil, score: nil, fairway_hit: nil, gir: nil, putts: nil}

  setup %{conn: conn} do
    {:ok, conn: put_req_header(conn, "accept", "application/json")}
  end

  describe "index" do
    test "lists all holes", %{conn: conn} do
      conn = get(conn, ~p"/api/holes")
      assert json_response(conn, 200)["data"] == []
    end
  end

  describe "create hole" do
    test "renders hole when data is valid", %{conn: conn} do
      conn = post(conn, ~p"/api/holes", hole: @create_attrs)
      assert %{"id" => id} = json_response(conn, 201)["data"]

      conn = get(conn, ~p"/api/holes/#{id}")

      assert %{
               "id" => ^id,
               "fairway_hit" => true,
               "gir" => true,
               "hole_number" => 42,
               "par" => 42,
               "putts" => 42,
               "score" => 42
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn} do
      conn = post(conn, ~p"/api/holes", hole: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "update hole" do
    setup [:create_hole]

    test "renders hole when data is valid", %{conn: conn, hole: %Hole{id: id} = hole} do
      conn = put(conn, ~p"/api/holes/#{hole}", hole: @update_attrs)
      assert %{"id" => ^id} = json_response(conn, 200)["data"]

      conn = get(conn, ~p"/api/holes/#{id}")

      assert %{
               "id" => ^id,
               "fairway_hit" => false,
               "gir" => false,
               "hole_number" => 43,
               "par" => 43,
               "putts" => 43,
               "score" => 43
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn, hole: hole} do
      conn = put(conn, ~p"/api/holes/#{hole}", hole: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "delete hole" do
    setup [:create_hole]

    test "deletes chosen hole", %{conn: conn, hole: hole} do
      conn = delete(conn, ~p"/api/holes/#{hole}")
      assert response(conn, 204)

      assert_error_sent 404, fn ->
        get(conn, ~p"/api/holes/#{hole}")
      end
    end
  end

  defp create_hole(_) do
    hole = hole_fixture()
    %{hole: hole}
  end
end
