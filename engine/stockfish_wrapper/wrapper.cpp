#include <emscripten.h>
#include <string>

#include "StockfishWrapper.h"

static StockfishWrapper* instance = nullptr;
static std::string outputStore; // stable pointer for JS — valid until next call

extern "C" {

EMSCRIPTEN_KEEPALIVE
void sf_init()
{
    if (!instance)
        instance = new StockfishWrapper();
}

EMSCRIPTEN_KEEPALIVE
void sf_send_uci_message(const char* message)
{
    if (instance)
        instance->execute(std::string(message));
}

EMSCRIPTEN_KEEPALIVE
const char* sf_get_output()
{
    if (!instance)
    {
        outputStore.clear();
        return outputStore.c_str();
    }
    outputStore = instance->getOutput();
    return outputStore.c_str();
}

} // extern "C"
