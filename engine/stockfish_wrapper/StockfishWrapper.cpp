#include <mutex>

#include "bitboard.h"
#include "position.h"
#include "score.h"
#include "search.h"
#include "uci.h"
#include "StockfishWrapper.h"

StockfishWrapper::StockfishWrapper()
{
    // Bitboards::init() and Position::init() MUST run before Engine is constructed
    // (Engine::Engine calls pos.set(StartFEN,...) which requires both tables).
    Bitboards::init();
    Position::init();
    engine = std::make_unique<Engine>();
    setupCallbacks();
}

void StockfishWrapper::execute(const std::string& message)
{
    std::istringstream is(message);
    std::string token;
    is >> std::skipws >> token;

    if (token.empty())
        return;

    if (token == "uci")
    {
        pushOutput("id name Stockfish (WASM)");
        pushOutput("id author The Stockfish developers");
        pushOutput("uciok");
    }
    else if (token == "isready")
    {
        engine->wait_for_search_finished();
        pushOutput("readyok");
    }
    else if (token == "ucinewgame")
    {
        engine->wait_for_search_finished();
        engine->search_clear();
    }
    else if (token == "setoption")
    {
        engine->wait_for_search_finished();
        engine->get_options().setoption(is);
    }
    else if (token == "position")
    {
        engine->wait_for_search_finished();
        parsePosition(is);
    }
    else if (token == "go")
    {
        clearOutput();
        auto limits = UCIEngine::parse_limits(is);
        engine->go(limits);
        engine->wait_for_search_finished();
    }
    else if (token == "stop")
    {
        engine->stop();
        engine->wait_for_search_finished();
    }
}

std::string StockfishWrapper::getOutput()
{
    std::lock_guard<std::mutex> lock(outputMutex);
    std::string result;
    result.reserve(4096);

    for (const auto& line : outputBuffer)
    {
        result += line;
        result += '\n';
    }

    return result;
}

void StockfishWrapper::pushOutput(const std::string& line)
{
    std::lock_guard<std::mutex> lock(outputMutex);
    outputBuffer.push_back(line);
}

void StockfishWrapper::clearOutput()
{
    std::lock_guard<std::mutex> lock(outputMutex);
    outputBuffer.clear();
}

void StockfishWrapper::setupCallbacks()
{
    engine->set_on_verify_networks([this](std::string_view msg) { pushOutput(std::string(msg)); });

    engine->set_on_update_full([this](const Engine::InfoFull& info) {
        std::stringstream ss;
        ss << "info"
           << " depth " << info.depth << " seldepth " << info.selDepth << " multipv "
           << info.multiPV << " score " << UCIEngine::format_score(info.score);

        if (!info.bound.empty())
            ss << ' ' << std::string(info.bound);

        ss << " nodes " << info.nodes << " nps " << info.nps << " hashfull " << info.hashfull
           << " tbhits " << info.tbHits << " time " << info.timeMs << " pv "
           << std::string(info.pv);

        pushOutput(ss.str());
    });

    engine->set_on_update_no_moves([this](const Engine::InfoShort& info) {
        pushOutput("info depth " + std::to_string(info.depth) + " score " +
                   UCIEngine::format_score(info.score));
    });

    engine->set_on_bestmove([this](std::string_view bm, std::string_view ponder) {
        std::string msg = "bestmove " + std::string(bm);
        if (!ponder.empty())
            msg += " ponder " + std::string(ponder);
        pushOutput(msg);
    });
}

void StockfishWrapper::parsePosition(std::istringstream& is)
{
    std::string token, fen;
    is >> token;

    if (token == "startpos")
    {
        fen = StartFEN;
        is >> token; // consume optional "moves"
    }
    else if (token == "fen")
    {
        while (is >> token && token != "moves")
            fen += token + ' ';
    }
    else
    {
        return;
    }

    std::vector<std::string> moves;
    while (is >> token)
        moves.push_back(token);

    engine->set_position(fen, moves);
}
